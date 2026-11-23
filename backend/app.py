import io
import os
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import pypdf
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("internagent")

# Load environment
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Configure Gemini with REST transport to prevent gRPC deadline issues
if GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_"):
    try:
        genai.configure(api_key=GEMINI_API_KEY, transport="rest")
        logger.info("Gemini AI successfully configured with REST transport.")
    except Exception as e:
        logger.error(f"Error configuring Gemini: {e}")
else:
    logger.warning("GEMINI_API_KEY is not configured or using placeholder.")

# Configure Supabase
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY and not SUPABASE_KEY.startswith("your_"):
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")

# Gemini model fallback chain
FALLBACK_MODELS: List[str] = [
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
]

# Session memory stores (fallbacks if Supabase schema migration is pending)
GLOBAL_RESUME_CACHE: Dict[str, Dict[str, Any]] = {}
GLOBAL_LISTINGS_CACHE: Dict[str, List[Dict[str, Any]]] = {}

app = FastAPI(
    title="InternAgent API",
    description="Backend API for InternAgent - AI Internship Hunting Assistant",
    version="0.3.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_json_from_llm_response(text: str) -> Dict[str, Any]:
    """Cleans markdown fences and parses valid JSON from LLM response."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)

def get_authenticated_user_id(authorization: Optional[str] = None, user_id_param: Optional[str] = None) -> str:
    """Validates Supabase token if provided and returns user_id, or user_id_param, or fallback."""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token and supabase:
            try:
                user_res = supabase.auth.get_user(token)
                if user_res and user_res.user:
                    return user_res.user.id
            except Exception as e:
                logger.warning(f"Could not verify token with supabase: {e}")

    if user_id_param and user_id_param.strip():
        return user_id_param.strip()

    return "00000000-0000-0000-0000-000000000000"

def get_db_client(authorization: Optional[str] = None) -> Optional[Client]:
    """Returns Supabase client, attaching authorization bearer token if present for RLS."""
    if not supabase:
        return None
    if not authorization:
        return supabase
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return supabase
    try:
        return create_client(
            SUPABASE_URL,
            SUPABASE_KEY,
            options=ClientOptions(headers={"Authorization": f"Bearer {token}"})
        )
    except Exception as e:
        logger.warning(f"Could not create authenticated client: {e}")
        return supabase

def fetch_text_from_url(url: str) -> str:
    """Fetches web page content and extracts clean textual representation."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers, timeout=12)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    for elem in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "iframe"]):
        elem.decompose()

    text = soup.get_text(separator="\n")
    cleaned_lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(cleaned_lines)

# Schemas
class ListingAnalyzeRequest(BaseModel):
    description: Optional[str] = Field(None, description="Pasted job description text")
    url: Optional[str] = Field(None, description="URL of the job posting to fetch")
    user_id: Optional[str] = Field(None, description="Candidate user id")

class UpdateStatusRequest(BaseModel):
    status: str = Field(..., description="Application status: not_applied | applied | replied")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "InternAgent Backend",
        "version": "0.3.0",
        "gemini_active": bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_")),
        "supabase_connected": bool(supabase is not None),
    }

# --- RESUME ENDPOINTS ---

@app.post("/api/resume/upload", status_code=status.HTTP_200_OK)
async def upload_resume(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """
    Accepts candidate PDF resume, extracts raw text with pypdf,
    sends to Gemini AI for structured extraction, and saves to Supabase.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF resumes are supported."
        )

    try:
        contents = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        raw_text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                raw_text += page_text + "\n"

        raw_text = raw_text.strip()
        if not raw_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not extract text from this PDF. Please ensure the resume is not scanned as an image."
            )
        logger.info(f"Extracted {len(raw_text)} characters from '{file.filename}'.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing PDF with pypdf: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process PDF: {str(e)}"
        )

    if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("your_"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gemini API key is not configured."
        )

    parse_prompt = f"""
You are an expert AI recruiter and resume parser.
Analyze the following resume text and parse it into a clean, comprehensive JSON object.

Extract and structure the data strictly adhering to this JSON schema:
{{
  "name": "Candidate Full Name",
  "contact": {{
    "email": "Email address or null",
    "phone": "Phone number or null",
    "location": "City, State/Country or null",
    "linkedin": "LinkedIn profile URL or null",
    "github": "GitHub profile URL or null",
    "portfolio": "Portfolio/Website URL or null"
  }},
  "summary": "1-2 sentence professional overview or null",
  "skills": ["List of skills, technologies, frameworks, tools, languages"],
  "experience": [
    {{
      "role": "Job / Internship Title",
      "company": "Company Name",
      "duration": "Employment dates (e.g. May 2024 - Aug 2024)",
      "description": "Summary of responsibilities and key achievements"
    }}
  ],
  "education": [
    {{
      "institution": "University / College / School",
      "degree": "Degree and Major / Field of Study",
      "duration": "Dates attended or Graduation Year",
      "gpa": "GPA if listed or null"
    }}
  ],
  "projects": [
    {{
      "title": "Project Title",
      "description": "Short explanation of what was built and impact",
      "tech_stack": ["Technologies used"],
      "link": "Project URL or null"
    }}
  ]
}}

Return ONLY valid JSON. Do not include markdown preamble.

Resume Text:
{raw_text}
"""

    parsed_json = None
    model_used = None
    last_error = None

    for model_name in FALLBACK_MODELS:
        try:
            logger.info(f"Attempting resume parsing with: {model_name}")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(parse_prompt)
            if response and response.text:
                parsed_json = extract_json_from_llm_response(response.text)
                model_used = model_name
                break
        except Exception as e:
            logger.warning(f"Model {model_name} failed: {e}")
            last_error = e

    if not parsed_json:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI parsing failed: {str(last_error)}"
        )

    effective_user_id = get_authenticated_user_id(authorization, user_id)

    # Save to global cache
    GLOBAL_RESUME_CACHE[effective_user_id] = {
        "file_name": file.filename,
        "raw_text": raw_text,
        "parsed_json": parsed_json,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }

    # Attempt Supabase persistence
    saved_to_supabase = False
    supabase_record_id = None
    db_client = get_db_client(authorization)
    if db_client:
        try:
            insert_payload = {
                "user_id": effective_user_id,
                "file_name": file.filename,
                "raw_text": raw_text,
                "parsed_json": parsed_json,
            }
            db_response = db_client.table("resumes").insert(insert_payload).execute()
            if db_response.data and len(db_response.data) > 0:
                saved_to_supabase = True
                supabase_record_id = db_response.data[0].get("id")
        except Exception as db_err:
            logger.warning(f"Could not persist resume to Supabase 'resumes' table: {db_err}")

    return {
        "status": "success",
        "file_name": file.filename,
        "raw_text_length": len(raw_text),
        "model_used": model_used,
        "saved_to_supabase": saved_to_supabase,
        "record_id": supabase_record_id,
        "user_id": effective_user_id,
        "parsed_resume": parsed_json,
    }

@app.get("/api/resume/latest")
def get_latest_resume(
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Retrieves the latest parsed resume for the candidate."""
    effective_user_id = get_authenticated_user_id(authorization, user_id)

    # 1. Check Supabase
    db_client = get_db_client(authorization)
    if db_client:
        try:
            res = (
                db_client.table("resumes")
                .select("*")
                .eq("user_id", effective_user_id)
                .order("uploaded_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                return {"status": "success", "resume": res.data[0]}
        except Exception as e:
            logger.warning(f"Supabase resume lookup failed: {e}")

    # 2. Check session cache fallback
    if effective_user_id in GLOBAL_RESUME_CACHE:
        return {"status": "success", "resume": GLOBAL_RESUME_CACHE[effective_user_id]}
    if "00000000-0000-0000-0000-000000000000" in GLOBAL_RESUME_CACHE:
        return {"status": "success", "resume": GLOBAL_RESUME_CACHE["00000000-0000-0000-0000-000000000000"]}

    return {"status": "not_found", "resume": None}


# --- LISTING FIT-SCORING & OUTREACH ENGINE ---

@app.post("/api/listing/analyze", status_code=status.HTTP_200_OK)
def analyze_listing(
    payload: ListingAnalyzeRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Accepts job/internship description (text or URL), fetches the candidate's latest resume,
    sends both to Gemini to extract listing requirements, scores fit (0-100), gives reasoning,
    drafts a personalized cold outreach message, and stores to Supabase.
    """
    effective_user_id = get_authenticated_user_id(authorization, payload.user_id)

    # 1. Obtain raw description from text or URL
    raw_description = ""
    source_url = None

    if payload.url and payload.url.strip():
        source_url = payload.url.strip()
        try:
            logger.info(f"Fetching job listing from URL: {source_url}")
            raw_description = fetch_text_from_url(source_url)
        except Exception as e:
            logger.warning(f"Failed to fetch listing URL: {e}")
            if not payload.description:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Could not fetch listing from the provided URL: {str(e)}. Please paste the job description text directly."
                )

    if not raw_description and payload.description:
        raw_description = payload.description.strip()

    if not raw_description or len(raw_description) < 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job description text is too short or empty. Please provide a full internship or job posting."
        )

    # 2. Fetch candidate's latest parsed resume
    resume_data = None
    db_client = get_db_client(authorization)
    if db_client:
        try:
            res = (
                db_client.table("resumes")
                .select("parsed_json, raw_text")
                .eq("user_id", effective_user_id)
                .order("uploaded_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                resume_data = res.data[0].get("parsed_json")
        except Exception as e:
            logger.warning(f"Error querying resume in analyze: {e}")

    if not resume_data:
        # Fallback to in-memory session cache
        if effective_user_id in GLOBAL_RESUME_CACHE:
            resume_data = GLOBAL_RESUME_CACHE[effective_user_id].get("parsed_json")
        elif "00000000-0000-0000-0000-000000000000" in GLOBAL_RESUME_CACHE:
            resume_data = GLOBAL_RESUME_CACHE["00000000-0000-0000-0000-000000000000"].get("parsed_json")

    if not resume_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No resume found for your account. Please upload your resume on the dashboard before analyzing listings."
        )

    # 3. Call Gemini to perform fit scoring & outreach composition
    candidate_name = resume_data.get("name", "Candidate")
    candidate_skills = resume_data.get("skills", [])
    candidate_experience = resume_data.get("experience", [])
    candidate_projects = resume_data.get("projects", [])
    candidate_education = resume_data.get("education", [])

    analysis_prompt = f"""
You are an expert AI career coach, technical recruiter, and executive cold-outreach strategist.
You are given:
1. A candidate's structured resume metadata.
2. A job or internship listing.

=== CANDIDATE RESUME ===
Name: {candidate_name}
Skills: {json.dumps(candidate_skills)}
Experience: {json.dumps(candidate_experience)}
Projects: {json.dumps(candidate_projects)}
Education: {json.dumps(candidate_education)}

=== TARGET JOB / INTERNSHIP LISTING ===
{raw_description[:6000]}

=== INSTRUCTIONS ===
1. Analyze the listing:
   - Identify the Role Title and Company Name (infer from text, or use best descriptive name).
   - Extract required_skills (hard & soft skills expected), responsibilities (key tasks), and experience_level (e.g. "Internship", "Entry-Level (0-1 yrs)", "Undergraduate / Graduate").
2. Compare candidate's background against the listing requirements:
   - Calculate an objective, honest fit_score (integer between 0 and 100) reflecting real overlap.
     * 80-100: Exceptional match with strong experience and skills overlap.
     * 60-79: Strong fit with minor gaps in secondary tech.
     * 40-59: Moderate match with transferable concepts but noticeable technical gaps.
     * 0-39: Low overlap or divergent domain.
   - matching_skills: Specific skills and tools the candidate has that match the role.
   - missing_skills: Core or preferred skills in the listing that are missing from the resume.
   - strengths: 2-3 specific, evidence-based bullet points highlighting concrete overlaps (cite candidate's actual projects, internships, metrics, or technologies).
   - growth_areas: 1-2 constructive points the candidate should prepare to address in an interview.
   - overall_assessment: 2-3 sentences evaluating the match candidly.
3. Draft a tailored cold outreach message / email:
   - Written from the candidate ({candidate_name}) to a Recruiter or Engineering Hiring Manager.
   - Length: Concise, approximately 120-160 words.
   - Tone: Professional, high-conviction, humble, genuine, and human.
   - AVOID generic filler, corporate clichés, buzzwords, or sales pitches.
   - MUST reference 2-3 specific overlaps between the candidate's actual projects or past experience and this company's listed requirements.
   - Include a low-pressure call to action (e.g. "open to a brief 10-15 minute discussion or sharing a sample of my work").
   - Include a clear Subject line.

Return ONLY a valid JSON object strictly matching this schema:
{{
  "title": "Role Title",
  "company": "Company Name",
  "extracted_requirements": {{
    "required_skills": ["Skill1", "Skill2"],
    "responsibilities": ["Responsibility 1", "Responsibility 2"],
    "experience_level": "Internship"
  }},
  "fit_score": 85,
  "fit_reasoning": {{
    "matching_skills": ["Skill1", "Skill2"],
    "missing_skills": ["SkillX", "SkillY"],
    "strengths": [
      "Demonstrated production experience in X as shown in Project Y...",
      "Hands-on background with Z..."
    ],
    "growth_areas": [
      "No direct experience with Tool W; highlight quick ability to learn..."
    ],
    "overall_assessment": "Strong candidate with direct overlap in..."
  }},
  "outreach_draft": "Subject: ...\\n\\nHi [Hiring Team / Name],\\n\\n...\\n\\nBest regards,\\n{candidate_name}"
}}
"""

    analysis_result = None
    model_used = None
    last_err = None

    for model_name in FALLBACK_MODELS:
        try:
            logger.info(f"Analyzing listing with: {model_name}")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(analysis_prompt)
            if response and response.text:
                analysis_result = extract_json_from_llm_response(response.text)
                model_used = model_name
                break
        except Exception as e:
            logger.warning(f"Model {model_name} analysis failed: {e}")
            last_err = e

    if not analysis_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze listing with AI: {str(last_err)}"
        )

    # 4. Construct listing object
    listing_id = str(uuid.uuid4())
    title = analysis_result.get("title", "Software Engineering Intern")
    company = analysis_result.get("company", "Company")
    fit_score = max(0, min(100, int(analysis_result.get("fit_score", 75))))
    extracted_requirements = analysis_result.get("extracted_requirements", {})
    fit_reasoning = analysis_result.get("fit_reasoning", {})
    outreach_draft = analysis_result.get("outreach_draft", "")
    created_at = datetime.now(timezone.utc).isoformat()
    current_status = "not_applied"

    listing_record = {
        "id": listing_id,
        "user_id": effective_user_id,
        "title": title,
        "company": company,
        "source_url": source_url,
        "raw_description": raw_description,
        "extracted_requirements": extracted_requirements,
        "fit_score": fit_score,
        "fit_reasoning": fit_reasoning,
        "outreach_draft": outreach_draft,
        "status": current_status,
        "created_at": created_at,
        "updated_at": created_at,
    }

    # 5. Persist to Supabase if table exists
    saved_to_db = False
    if db_client:
        try:
            insert_res = db_client.table("listings").insert(listing_record).execute()
            if insert_res.data and len(insert_res.data) > 0:
                saved_to_db = True
                listing_record["id"] = insert_res.data[0].get("id", listing_id)
        except Exception as db_err:
            logger.warning(f"Could not persist to Supabase 'listings' table: {db_err}")

    # Also keep in in-memory list
    if effective_user_id not in GLOBAL_LISTINGS_CACHE:
        GLOBAL_LISTINGS_CACHE[effective_user_id] = []
    GLOBAL_LISTINGS_CACHE[effective_user_id].insert(0, listing_record)

    return {
        "status": "success",
        "saved_to_supabase": saved_to_db,
        "model_used": model_used,
        "listing": listing_record
    }

@app.get("/api/listings")
def list_listings(
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Returns all analyzed listings for the authenticated user."""
    effective_user_id = get_authenticated_user_id(authorization, user_id)

    db_client = get_db_client(authorization)
    if db_client:
        try:
            res = (
                db_client.table("listings")
                .select("*")
                .eq("user_id", effective_user_id)
                .order("created_at", desc=True)
                .execute()
            )
            if res.data is not None:
                return {"status": "success", "listings": res.data}
        except Exception as e:
            logger.warning(f"Supabase listings query failed: {e}")

    # Fallback to session cache
    listings = GLOBAL_LISTINGS_CACHE.get(effective_user_id, [])
    return {"status": "success", "listings": listings}

@app.get("/api/listing/{listing_id}")
def get_listing(
    listing_id: str,
    authorization: Optional[str] = Header(None)
):
    """Retrieves single listing details."""
    db_client = get_db_client(authorization)
    if db_client:
        try:
            res = db_client.table("listings").select("*").eq("id", listing_id).execute()
            if res.data and len(res.data) > 0:
                return {"status": "success", "listing": res.data[0]}
        except Exception as e:
            logger.warning(f"Supabase get listing failed: {e}")

    for user_listings in GLOBAL_LISTINGS_CACHE.values():
        for l in user_listings:
            if l.get("id") == listing_id:
                return {"status": "success", "listing": l}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found.")

@app.patch("/api/listing/{listing_id}/status")
def update_listing_status(
    listing_id: str,
    payload: UpdateStatusRequest,
    authorization: Optional[str] = Header(None)
):
    """Updates listing tracker status: not_applied | applied | replied."""
    valid_statuses = ["not_applied", "applied", "replied"]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    updated_at = datetime.now(timezone.utc).isoformat()
    db_client = get_db_client(authorization)
    if db_client:
        try:
            db_client.table("listings").update({
                "status": payload.status,
                "updated_at": updated_at
            }).eq("id", listing_id).execute()
        except Exception as e:
            logger.warning(f"Supabase status update failed: {e}")

    # Update in memory cache as well
    for user_listings in GLOBAL_LISTINGS_CACHE.values():
        for l in user_listings:
            if l.get("id") == listing_id:
                l["status"] = payload.status
                l["updated_at"] = updated_at
                return {"status": "success", "listing": l}

    return {"status": "success", "updated_id": listing_id, "new_status": payload.status}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
