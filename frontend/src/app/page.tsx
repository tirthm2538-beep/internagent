"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FileText, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  TrendingUp, 
  Activity,
  Layers,
  Database,
  ExternalLink
} from "lucide-react";

export default function Home() {
  const [backendHealth, setBackendHealth] = useState<{
    status: string;
    service?: string;
    version?: string;
    timestamp?: string;
  } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const res = await fetch(`${backendUrl}/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendHealth(data);
        } else {
          setBackendHealth(null);
        }
      } catch {
        setBackendHealth(null);
      } finally {
        setCheckingHealth(false);
      }
    };
    checkBackend();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              InternAgent
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              v0.1.0 Skeleton
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border bg-slate-900/80 border-slate-800">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${backendHealth ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${backendHealth ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </span>
              <span className="text-slate-400">Backend API:</span>
              <span className={backendHealth ? "text-emerald-400" : "text-amber-400"}>
                {checkingHealth ? "Checking..." : backendHealth ? "Online (200 OK)" : "Offline / Standby"}
              </span>
            </div>

            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
            >
              API Docs <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 rounded-lg transition-colors shadow-md shadow-indigo-600/20"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            AI-Powered Internship Hunting Wingman
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Stop Sending Blind Applications.{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
              Match & Outreach with AI.
            </span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Upload your resume once, paste job postings or URLs, and let InternAgent score your fit, highlight resume overlaps, and draft hyper-tailored recruiter cold messages.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Upload Resume (Dashboard)
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#architecture"
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold text-sm transition-all flex items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              View Architecture
            </a>
          </div>
        </div>

        {/* 4 Core Modules Grid */}
        <section className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-indigo-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white mb-2 text-base">1. Resume Parsing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload PDF once. Extracts skills, experience, projects, and education into structured candidate metadata.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-sky-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white mb-2 text-base">2. Fit Scoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compares resume vs target role. Generates a 0-100 match score with detailed skill overlaps and missing gaps.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white mb-2 text-base">3. Outreach Draft</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generates personalized cold messages and recruiter emails referencing specific accomplishments.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-amber-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white mb-2 text-base">4. Application Tracker</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Organizes all opportunities with statuses: Not Applied, Applied, or Replied, backed by Supabase.
            </p>
          </div>
        </section>

        {/* Architecture Snapshot & System Verification */}
        <section id="architecture" className="mt-16 p-8 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                System Health & Architecture Status
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Project skeleton initialized with FastAPI backend and Next.js App Router frontend.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-3 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
                Port 8000 (Backend)
              </span>
              <span className="text-xs px-3 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
                Port 3000 (Frontend)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div className="text-slate-400 mb-1 flex items-center justify-between">
                <span>FastAPI Service</span>
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <p className="text-emerald-400 font-medium">GET /health</p>
              <p className="text-slate-500 mt-1 truncate">
                {backendHealth?.timestamp ? `Active at ${backendHealth.timestamp}` : "Ready for connection"}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div className="text-slate-400 mb-1 flex items-center justify-between">
                <span>Next.js App Router</span>
                <Layers className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <p className="text-sky-400 font-medium">React 19 + Tailwind CSS</p>
              <p className="text-slate-500 mt-1">TypeScript Strict Mode</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div className="text-slate-400 mb-1 flex items-center justify-between">
                <span>Supabase & Gemini</span>
                <Database className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-indigo-400 font-medium">Auth & Vector RLS</p>
              <p className="text-slate-500 mt-1">Gemini 3.8 Flash Ready</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        InternAgent &copy; 2026 — Built with FastAPI, Next.js, Gemini & Supabase
      </footer>
    </div>
  );
}
