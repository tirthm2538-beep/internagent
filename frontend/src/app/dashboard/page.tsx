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
  ArrowRight
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

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Resume Upload State
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [rawTextLength, setRawTextLength] = useState<number>(0);
  const [modelUsed, setModelUsed] = useState<string>("");
  const [savedToDb, setSavedToDb] = useState<boolean>(false);

  // Check auth session on load
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        setSession(session);

        // Attempt to fetch existing resume from backend
        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
          const res = await fetch(`${backendUrl}/api/resume/latest`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === "success" && data.resume?.parsed_json) {
              setParsedResume(data.resume.parsed_json);
              setSavedToDb(true);
            }
          }
        } catch {
          // No previous resume or backend starting up
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      } finally {
        setLoadingSession(false);
      }
    };

    checkUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
        setErrorMsg("Please select a PDF file (.pdf).");
        setFile(null);
        return;
      }
      setErrorMsg("");
      setFile(selectedFile);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select a PDF resume to upload.");
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setUploadStep("Reading PDF pages with pypdf...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (session?.user?.id) {
        formData.append("user_id", session.user.id);
      }

      setUploadStep("Analyzing resume with Gemini AI...");
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
      setRawTextLength(data.raw_text_length || 0);
      setModelUsed(data.model_used || "gemini-3.5-flash");
      setSavedToDb(data.saved_to_supabase || false);
      setSuccessMsg("Resume parsed successfully! Review the extracted metadata below.");
      setFile(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to upload and parse resume.");
      }
    } finally {
      setUploading(false);
      setUploadStep("");
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Loading candidate session...</span>
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
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              Candidate Dashboard
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">
                {session?.user?.user_metadata?.full_name || "Intern Candidate"}
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

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Resume Profile & Verification
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Upload your PDF resume once. Gemini AI extracts your skills, timeline, and education to match against future listings.
            </p>
          </div>

          {parsedResume && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium self-start sm:self-auto">
              <CheckCircle2 className="w-4 h-4" />
              Active Resume Configured
            </div>
          )}
        </div>

        {/* Upload Area (Shown if no parsed resume OR if user clicks re-upload) */}
        {(!parsedResume || file !== null) && (
          <section className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-sm">
            <div className="max-w-2xl mx-auto text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Upload Your Resume (PDF)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Supported format: standard single or multi-page PDF documents. Max 10MB.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2.5 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpload} className="space-y-4">
                <div className="relative border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl p-6 transition-all bg-slate-950/40 cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-sm font-medium text-slate-300">
                      {file ? file.name : "Click to browse or drop your PDF here"}
                    </span>
                    {file && (
                      <span className="text-xs text-indigo-400 font-mono">
                        {(file.size / 1024).toFixed(1)} KB selected
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{uploadStep || "Processing..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Parse & Extract with AI</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* Parsed Resume Display Card */}
        {parsedResume && (
          <section className="space-y-6">
            {successMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                {modelUsed && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Engine: {modelUsed}
                  </span>
                )}
              </div>
            )}

            {/* Profile Header Card */}
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-800/80 pb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {parsedResume.name || "Candidate Profile"}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                      AI Verified
                    </span>
                  </div>

                  {parsedResume.summary && (
                    <p className="text-slate-300 text-sm mt-3 leading-relaxed max-w-3xl">
                      {parsedResume.summary}
                    </p>
                  )}

                  {/* Contact Badges */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-slate-400">
                    {parsedResume.contact?.email && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700/60">
                        <Mail className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{parsedResume.contact.email}</span>
                      </div>
                    )}
                    {parsedResume.contact?.phone && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700/60">
                        <Phone className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{parsedResume.contact.phone}</span>
                      </div>
                    )}
                    {parsedResume.contact?.location && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700/60">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{parsedResume.contact.location}</span>
                      </div>
                    )}
                    {parsedResume.contact?.linkedin && (
                      <a
                        href={parsedResume.contact.linkedin.startsWith("http") ? parsedResume.contact.linkedin : `https://${parsedResume.contact.linkedin}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700/60 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.8v8.37h-2.8V10.9M7.86 6.3a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24" />
                        </svg>
                        <span>LinkedIn</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {parsedResume.contact?.github && (
                      <a
                        href={parsedResume.contact.github.startsWith("http") ? parsedResume.contact.github : `https://${parsedResume.contact.github}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
                        </svg>
                        <span>GitHub</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {parsedResume.contact?.portfolio && (
                      <a
                        href={parsedResume.contact.portfolio.startsWith("http") ? parsedResume.contact.portfolio : `https://${parsedResume.contact.portfolio}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Portfolio</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Re-upload Resume</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-500 text-center font-mono">
                    {savedToDb ? "Synced to Supabase" : "Cached in Session"}
                  </span>
                </div>
              </div>

              {/* Skills Badge Cloud */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    Extracted Skills & Competencies
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {parsedResume.skills?.length || 0} Skills
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {parsedResume.skills && parsedResume.skills.length > 0 ? (
                    parsedResume.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 transition-colors"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">No specific skills listed.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Experience & Education Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Experience Timeline (2 cols) */}
              <div className="lg:col-span-2 p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-sky-400" />
                  Experience Timeline
                </h3>

                {parsedResume.experience && parsedResume.experience.length > 0 ? (
                  <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {parsedResume.experience.map((exp, idx) => (
                      <div key={idx} className="relative group">
                        {/* Timeline node */}
                        <div className="absolute -left-[29px] top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-indigo-500 group-hover:scale-125 transition-transform" />

                        <div className="space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {exp.role}
                            </h4>
                            <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 self-start sm:self-auto">
                              {exp.duration}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-sky-400">
                            {exp.company}
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line mt-2">
                            {exp.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No previous experience detected.</p>
                )}
              </div>

              {/* Education & Projects (1 col) */}
              <div className="space-y-6">
                {/* Education Card */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-400" />
                    Education
                  </h3>

                  {parsedResume.education && parsedResume.education.length > 0 ? (
                    <div className="space-y-4">
                      {parsedResume.education.map((edu, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                          <h4 className="text-xs font-bold text-white">{edu.institution}</h4>
                          <p className="text-xs text-slate-300">{edu.degree}</p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span>{edu.duration}</span>
                            {edu.gpa && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                GPA: {edu.gpa}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No education recorded.</p>
                  )}
                </div>

                {/* Projects Card */}
                {parsedResume.projects && parsedResume.projects.length > 0 && (
                  <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Code className="w-4 h-4 text-amber-400" />
                      Key Projects
                    </h3>

                    <div className="space-y-3">
                      {parsedResume.projects.map((proj, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white">{proj.title}</h4>
                            {proj.link && (
                              <a
                                href={proj.link.startsWith("http") ? proj.link : `https://${proj.link}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 hover:text-indigo-300"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {proj.description}
                          </p>
                          {proj.tech_stack && proj.tech_stack.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {proj.tech_stack.map((t, tidx) => (
                                <span key={tidx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Next Step Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-base">Resume Profile Verified & Ready!</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your credentials are structured and ready to analyze match scores against internship postings in Step 3.
                </p>
              </div>
              <button
                onClick={() => alert("Job Listing Fit Matching arriving in Step 3!")}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 shrink-0"
              >
                <span>Proceed to Listing Matcher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
