# InternAgent 🎯🤖

> **Your AI-Powered Internship Hunting Wingman**

InternAgent helps students and job seekers cut through the noise of internship applications. Upload your resume once, paste target job postings or URLs, and let AI analyze your fit, compute match scores, highlight skill gaps, and generate authentic, tailored outreach emails in seconds.

---

## 🚀 Key Features

1. **One-Time Resume Parsing**: Upload your PDF resume once. InternAgent extracts skills, projects, work experience, and educational background into structured profile data.
2. **Instant Listing Analysis**: Paste job descriptions or URLs to automatically extract role requirements and key responsibilities.
3. **Fit Scoring & Gap Breakdown**: Receive an objective $0-100$ match score accompanied by direct skill matches, transferable qualifications, and areas for improvement.
4. **Tailored Outreach Generation**: Automatically draft personalized cold outreach messages and recruiter emails referencing the exact overlap between your credentials and the role.
5. **Application Tracker Dashboard**: Track all analyzed applications, their match scores, status (`not applied`, `applied`, `replied`), and outreach messages in one unified dashboard.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python 3.12), Google Gemini 3.8 Flash, `pypdf`, `supabase-py`, `uvicorn`
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security & Supabase Auth)
- **Deployment**: Local dev / Vercel (Frontend) & Cloud (Backend)

---

## 📦 Project Structure

```
internagent/
├── backend/
│   ├── app.py                # FastAPI main application & CORS setup
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment variable template
│   └── .gitignore            # Backend gitignore
├── frontend/
│   ├── src/
│   │   └── app/              # Next.js App Router (pages & layout)
│   ├── package.json          # Node dependencies & scripts
│   ├── tsconfig.json         # TypeScript configuration
│   └── tailwind.config.ts    # Tailwind styling configuration
├── PROJECT_STATE.md          # Architecture, system state & roadmap
├── README.md                 # Project overview & quickstart
└── .gitignore                # Root gitignore
```

---

## ⚡ Quickstart

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY in .env

uvicorn app:app --reload --port 8000
```
API will run at [http://localhost:8000](http://localhost:8000) (Docs at `/docs`, Health check at `/health`).

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will run at [http://localhost:3000](http://localhost:3000).

---

## 📄 License
MIT
