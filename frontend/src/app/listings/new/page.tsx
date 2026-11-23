"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Sparkles, 
  ArrowLeft, 
  Send, 
  Copy, 
  Check, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  Building2, 
  Briefcase, 
  Link as LinkIcon, 
  FileText, 
  RefreshCw, 
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface AnalyzedListing {
  id: string;
  title: string;
  company: string;
  source_url?: string | null;
  fit_score: number;
  extracted_requirements: {
    required_skills?: string[];
    responsibilities?: string[];
    experience_level?: string;
  };
  fit_reasoning: {
    matching_skills?: string[];
    missing_skills?: string[];
    strengths?: string[];
    growth_areas?: string[];
    overall_assessment?: string;
  };
  outreach_draft: string;
  status: string;
}

export default function NewListingPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Input states
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Analysis result state
  const [result, setResult] = useState<AnalyzedListing | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        setSession(session);
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      } finally {
        setLoadingSession(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (inputMode === "text" && (!description || description.trim().length < 30)) {
      setErrorMsg("Please paste a complete job/internship description (at least 30 characters).");
      return;
    }

    if (inputMode === "url" && (!url || !url.trim().startsWith("http"))) {
      setErrorMsg("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setAnalyzing(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const payload = {
        description: inputMode === "text" ? description.trim() : null,
        url: inputMode === "url" ? url.trim() : null,
        user_id: session?.user?.id || null,
      };

      const res = await fetch(`${backendUrl}/api/listing/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Analysis failed. Ensure your resume is uploaded.");
      }

      setResult(data.listing);
      // Scroll to top of results
      window.scrollTo({ top: 400, behavior: "smooth" });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("An unexpected error occurred while analyzing the listing.");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result?.outreach_draft) return;
    try {
      await navigator.clipboard.writeText(result.outreach_draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", ring: "stroke-emerald-400", badge: "Exceptional Fit" };
    if (score >= 65) return { bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-400", ring: "stroke-sky-400", badge: "Strong Match" };
    if (score >= 45) return { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", ring: "stroke-amber-400", badge: "Moderate Fit" };
    return { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", ring: "stroke-rose-400", badge: "Low Overlap" };
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Verifying candidate session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                InternAgent
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Tracked Listings
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-10">
        {/* Title */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-3">
            <TrendingUp className="w-3.5 h-3.5" />
            Listing Fit Scoring & Outreach Engine
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Analyze an Internship Listing
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Paste a job description or URL. The AI compares the role against your uploaded resume, calculates an objective 0-100 fit score, and crafts a tailored cold message.
          </p>
        </div>

        {/* Input Form Card */}
        <section className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950/80 border border-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setInputMode("text")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputMode === "text"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Description Text</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode("url")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputMode === "url"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Fetch from URL</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-4 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold">Analysis Notice</p>
                <p className="mt-0.5">{errorMsg}</p>
                {errorMsg.includes("resume") && (
                  <Link
                    href="/dashboard"
                    className="inline-block mt-2 text-indigo-400 hover:underline font-semibold"
                  >
                    Go to Dashboard to Upload Resume &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleAnalyze} className="space-y-4">
            {inputMode === "text" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Job Description / Role Requirements
                </label>
                <textarea
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Paste the full job description here... (e.g., Company, Role Title, Qualifications, Tech Stack, Responsibilities)"
                  className="block w-full rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Job Posting URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://jobs.lever.co/company/example-role"
                  className="block w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  The backend will fetch the page and extract the relevant text automatically.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={analyzing}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Cross-Evaluating Resume with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Fit & Generate Outreach</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Results Section */}
        {result && (
          <section className="space-y-8 animate-fadeIn">
            {/* Fit Score Banner */}
            {(() => {
              const colors = getScoreColor(result.fit_score);
              return (
                <div className={`p-8 rounded-2xl ${colors.bg} border ${colors.border} shadow-2xl space-y-6 backdrop-blur-sm`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800/80 pb-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-white">{result.company}</span>
                        <span>&bull;</span>
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <span>{result.title}</span>
                      </div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">
                        Fit Score Analysis
                      </h2>
                      {result.fit_reasoning?.overall_assessment && (
                        <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                          {result.fit_reasoning.overall_assessment}
                        </p>
                      )}
                    </div>

                    {/* Prominent Score Gauge */}
                    <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 self-start md:self-auto shrink-0">
                      <div className="text-center">
                        <div className={`text-4xl font-extrabold tracking-tight ${colors.text}`}>
                          {result.fit_score}
                          <span className="text-sm font-semibold text-slate-500">/100</span>
                        </div>
                        <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {colors.badge}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Skills Overlap & Gaps Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Matching Skills */}
                    <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Direct Matching Skills ({result.fit_reasoning?.matching_skills?.length || 0})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {result.fit_reasoning?.matching_skills && result.fit_reasoning.matching_skills.length > 0 ? (
                          result.fit_reasoning.matching_skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">No exact matching skills detected.</span>
                        )}
                      </div>
                    </div>

                    {/* Missing Skills / Gaps */}
                    <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                      <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        Skill Gaps & Missing Reqs ({result.fit_reasoning?.missing_skills?.length || 0})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {result.fit_reasoning?.missing_skills && result.fit_reasoning.missing_skills.length > 0 ? (
                          result.fit_reasoning.missing_skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/25"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-emerald-400 italic">No major skill gaps identified!</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Strengths & Growth Areas */}
                  {result.fit_reasoning?.strengths && result.fit_reasoning.strengths.length > 0 && (
                    <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Specific Evidence & Resume Strengths
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {result.fit_reasoning.strengths.map((str, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">&bull;</span>
                            <span className="leading-relaxed">{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tailored Cold Outreach Draft Card */}
            <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-400" />
                    Tailored Cold Outreach Draft
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Personalized message referencing specific projects and credentials that solve this role&apos;s requirements.
                  </p>
                </div>

                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all self-start sm:self-auto shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Outreach Message</span>
                    </>
                  )}
                </button>
              </div>

              {/* Message Content */}
              <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap select-all">
                {result.outreach_draft}
              </div>

              {/* Action Links */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    setResult(null);
                    setDescription("");
                    setUrl("");
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  &larr; Analyze Another Listing
                </button>

                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <span>View All Tracked Listings in Dashboard</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
