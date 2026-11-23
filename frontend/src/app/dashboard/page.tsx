"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Sparkles, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Briefcase, 
  GraduationCap, 
  Code, 
  LogOut, 
  RefreshCw, 
  AlertCircle, 
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Globe,
  ArrowRight,
  Plus,
  Building2,
  Copy,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Filter
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface ParsedResume {
  name?: string;
  contact?: {
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    linkedin?: string | null;
    github?: string | null;
    portfolio?: string | null;
  };
  summary?: string | null;
  skills?: string[];
  experience?: Array<{
    role: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    duration: string;
    gpa?: string | null;
  }>;
  projects?: Array<{
    title: string;
    description: string;
    tech_stack?: string[];
    link?: string | null;
  }>;
}

interface ListingRecord {
  id: string;
  title: string;
  company: string;
  source_url?: string | null;
  fit_score: number;
  extracted_requirements?: {
    required_skills?: string[];
    responsibilities?: string[];
    experience_level?: string;
  };
  fit_reasoning?: {
    matching_skills?: string[];
    missing_skills?: string[];
    strengths?: string[];
    growth_areas?: string[];
    overall_assessment?: string;
  };
  outreach_draft: string;
  status: "not_applied" | "applied" | "replied";
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Resume State
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [resumeError, setResumeError] = useState<string>("");
  const [resumeSuccess, setResumeSuccess] = useState<string>("");
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [showResumeDetails, setShowResumeDetails] = useState(false);

  // Listings State
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedListing, setSelectedListing] = useState<ListingRecord | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Check auth session & fetch initial data
  useEffect(() => {
    const initDashboard = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        setSession(session);

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const headers: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };

        // 1. Fetch latest resume
        try {
          const res = await fetch(`${backendUrl}/api/resume/latest`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.status === "success" && data.resume?.parsed_json) {
              setParsedResume(data.resume.parsed_json);
            }
          }
        } catch (e) {
          console.warn("Could not load latest resume:", e);
        }

        // 2. Fetch analyzed listings
        try {
          setLoadingListings(true);
          const listRes = await fetch(`${backendUrl}/api/listings`, { headers });
          if (listRes.ok) {
            const listData = await listRes.json();
            if (listData.status === "success" && Array.isArray(listData.listings)) {
              setListings(listData.listings);
            }
          }
        } catch (e) {
          console.warn("Could not load listings:", e);
        } finally {
          setLoadingListings(false);
        }
      } catch (err) {
        console.error("Dashboard initialization error:", err);
        router.push("/login");
      } finally {
        setLoadingSession(false);
      }
    };

    initDashboard();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
        setResumeError("Please select a PDF file (.pdf).");
        setFile(null);
        return;
      }
      setResumeError("");
      setFile(selectedFile);
    }
  };

  const handleUploadResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setResumeError("");
    setResumeSuccess("");
    setUploadStep("Reading PDF pages with pypdf...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (session?.user?.id) {
        formData.append("user_id", session.user.id);
      }

      setUploadStep("Parsing candidate profile with Gemini AI...");
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${backendUrl}/api/resume/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to parse resume.");
      }

      const data = await res.json();
      setParsedResume(data.parsed_resume);
      setResumeSuccess("Resume updated successfully!");
      setFile(null);
      setShowResumeDetails(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResumeError(err.message);
      } else {
        setResumeError("Failed to upload and parse resume.");
      }
    } finally {
      setUploading(false);
      setUploadStep("");
    }
  };

  const handleUpdateStatus = async (listingId: string, newStatus: "not_applied" | "applied" | "replied") => {
    // Optimistic local update
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, status: newStatus } : l))
    );
    if (selectedListing && selectedListing.id === listingId) {
      setSelectedListing((prev) => prev ? { ...prev, status: newStatus } : null);
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      await fetch(`${backendUrl}/api/listing/${listingId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      console.error("Failed to update status on server:", e);
    }
  };

  const copyModalDraft = async () => {
    if (!selectedListing?.outreach_draft) return;
    try {
      await navigator.clipboard.writeText(selectedListing.outreach_draft);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    } catch {
      // fallback
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (score >= 65) return "bg-sky-500/10 text-sky-400 border-sky-500/30";
    if (score >= 45) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "applied":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "replied":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700/60";
    }
  };

  const filteredListings = listings.filter((l) => {
    if (statusFilter === "all") return true;
    return l.status === statusFilter;
  });

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              InternAgent
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">
                {parsedResume?.name || session?.user?.user_metadata?.full_name || "Candidate"}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {session?.user?.email}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-10">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Internship Tracker & Fit Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Match job listings against your resume, review fit scores, generate cold outreach, and track application progress.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/listings/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Analyze New Listing</span>
            </Link>
          </div>
        </div>

        {/* Resume Profile Banner / Compact Card */}
        <section className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base">
                    {parsedResume?.name ? `${parsedResume.name}'s Resume` : "Resume Profile"}
                  </h3>
                  {parsedResume ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                      Not Uploaded
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {parsedResume?.skills?.length
                    ? `${parsedResume.skills.length} skills detected &middot; Ready for automated job matching`
                    : "Upload your PDF resume once to enable fit scoring & cold outreach drafting"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {parsedResume && (
                <button
                  onClick={() => setShowResumeDetails(!showResumeDetails)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                >
                  {showResumeDetails ? "Hide Resume" : "View Extracted Skills"}
                </button>
              )}

              <label className="cursor-pointer px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{parsedResume ? "Upload New PDF" : "Upload Resume (PDF)"}</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Upload In-Progress / Selected File */}
          {file && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex items-center justify-between gap-4 mt-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold">{file.name}</span>
                <span className="text-slate-500 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUploadResume}
                  disabled={uploading}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{uploadStep || "Uploading..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Parse with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {resumeError && (
            <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {resumeError}
            </p>
          )}

          {resumeSuccess && (
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {resumeSuccess}
            </p>
          )}

          {/* Expandable Skills Cloud */}
          {showResumeDetails && parsedResume?.skills && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Recognized Resume Skills ({parsedResume.skills.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {parsedResume.skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-indigo-300 border border-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Analyzed Listings & Applications Table */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Analyzed Opportunities
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {listings.length}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  statusFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                All ({listings.length})
              </button>
              <button
                onClick={() => setStatusFilter("not_applied")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  statusFilter === "not_applied" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Not Applied
              </button>
              <button
                onClick={() => setStatusFilter("applied")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  statusFilter === "applied" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Applied
              </button>
              <button
                onClick={() => setStatusFilter("replied")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  statusFilter === "replied" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Replied
              </button>
            </div>
          </div>

          {/* Listings List */}
          {loadingListings ? (
            <div className="p-12 text-center text-slate-400 rounded-2xl bg-slate-900/40 border border-slate-800">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
              <p className="text-xs">Loading tracked applications...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">No listings analyzed yet</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Paste target internship postings or URLs to compute fit scores, pinpoint matching strengths, and generate customized recruiter messages.
                </p>
              </div>
              <Link
                href="/listings/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Analyze Your First Listing</span>
              </Link>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider bg-slate-950/50">
                      <th className="py-4 px-6">Company & Role</th>
                      <th className="py-4 px-6">Fit Score</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Analyzed</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredListings.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-850/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedListing(item)}
                      >
                        <td className="py-4 px-6">
                          <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">
                            {item.title}
                          </div>
                          <div className="text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>{item.company}</span>
                            {item.source_url && (
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-500 hover:text-slate-300 ml-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${getScoreBadge(
                              item.fit_score
                            )}`}
                          >
                            {item.fit_score}% Match
                          </span>
                        </td>

                        <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleUpdateStatus(item.id, e.target.value as any)
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer outline-none bg-slate-900 transition-all ${getStatusBadge(
                              item.status
                            )}`}
                          >
                            <option value="not_applied">Not Applied</option>
                            <option value="applied">Applied</option>
                            <option value="replied">Replied</option>
                          </select>
                        </td>

                        <td className="py-4 px-6 text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedListing(item);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-medium transition-all"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Listing Detail Modal / Drawer */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                    {selectedListing.company}
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getScoreBadge(
                      selectedListing.fit_score
                    )}`}
                  >
                    {selectedListing.fit_score}% Fit Score
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  {selectedListing.title}
                </h3>
              </div>

              <button
                onClick={() => setSelectedListing(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Selector in Modal */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-medium text-slate-300">Application Status:</span>
              <select
                value={selectedListing.status}
                onChange={(e) =>
                  handleUpdateStatus(selectedListing.id, e.target.value as any)
                }
                className={`px-3 py-1 rounded-lg text-xs font-bold border bg-slate-900 cursor-pointer ${getStatusBadge(
                  selectedListing.status
                )}`}
              >
                <option value="not_applied">Not Applied</option>
                <option value="applied">Applied</option>
                <option value="replied">Replied</option>
              </select>
            </div>

            {/* Overall Assessment */}
            {selectedListing.fit_reasoning?.overall_assessment && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-white block mb-1">Fit Assessment:</span>
                {selectedListing.fit_reasoning.overall_assessment}
              </div>
            )}

            {/* Matching & Missing Skills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Matching Skills
                </h4>
                <div className="flex flex-wrap gap-1">
                  {selectedListing.fit_reasoning?.matching_skills?.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                    >
                      {s}
                    </span>
                  )) || <span className="text-xs text-slate-500 italic">None noted</span>}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Missing Skills / Gaps
                </h4>
                <div className="flex flex-wrap gap-1">
                  {selectedListing.fit_reasoning?.missing_skills?.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/25"
                    >
                      {s}
                    </span>
                  )) || <span className="text-xs text-emerald-400 italic">No major gaps</span>}
                </div>
              </div>
            </div>

            {/* Outreach Message Draft */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Tailored Outreach Message
                </h4>
                <button
                  onClick={copyModalDraft}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                >
                  {copiedDraft ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Draft</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
                {selectedListing.outreach_draft}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedListing(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
