import io
import os
import json
import logging
import re
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pypdf
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

app = FastAPI(
    title="InternAgent API",
    description="Backend API for InternAgent - AI Internship Hunting Assistant",
    version="0.2.0"
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

def get_authenticated_user_id(authorization: Optional[str] = None, user_id_param: Optional[str] = None) -> Optional[str]:
    """Validates Supabase token if provided and returns user_id."""
    if not authorization:
        return user_id_param

    token = authorization.replace("Bearer ", "").strip()
    if not token or not supabase:
        return user_id_param

    try:
        user_res = supabase.auth.get_user(token)
        if user_res and user_res.user:
            return user_res.user.id
    except Exception as e:
        logger.warning(f"Could not verify token with supabase: {e}")
    return user_id_param

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "InternAgent Backend",
        "version": "0.2.0",
        "gemini_active": bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_")),
        "supabase_connected": bool(supabase is not None),
    }

@app.post("/api/resume/upload", status_code=status.HTTP_200_OK)
async def upload_resume(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """
    Accepts a candidate PDF resume, extracts raw text with pypdf,
    sends it to Gemini AI for structured extraction, and saves both raw text
    and parsed JSON into Supabase.
    """
    # 1. Validate file format
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF resumes are supported."
        )

    # 2. Extract text with pypdf
    try:
        contents = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        raw_text = ""
        for page_num, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text()
            if page_text:
                raw_text += page_text + "\n"

        raw_text = raw_text.strip()
        if not raw_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not extract text from this PDF. Please ensure the resume is not scanned as an image."
            )
        logger.info(f"Successfully extracted {len(raw_text)} characters from '{file.filename}'.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing PDF with pypdf: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process PDF: {str(e)}"
        )

    # 3. Call Gemini AI to parse structured JSON
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
            logger.info(f"Attempting resume parsing with model: {model_name}")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(parse_prompt)
            if response and response.text:
                parsed_json = extract_json_from_llm_response(response.text)
                model_used = model_name
                logger.info(f"Successfully parsed resume using model: {model_name}")
                break
        except Exception as e:
            logger.warning(f"Model {model_name} failed: {e}")
            last_error = e

    if not parsed_json:
        logger.error(f"All Gemini models failed to parse resume: {last_error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI parsing failed: {str(last_error)}"
        )

    # 4. Resolve authenticated user_id
    effective_user_id = get_authenticated_user_id(authorization, user_id)
    if not effective_user_id:
        effective_user_id = "00000000-0000-0000-0000-000000000000"

    # 5. Store into Supabase if configured
    saved_to_supabase = False
    supabase_record_id = None

    if supabase:
        try:
            # If token is provided, initialize client with user auth header for RLS
            auth_token = authorization.replace("Bearer ", "").strip() if authorization else None
            db_client = supabase
            if auth_token:
                try:
                    db_client = create_client(
                        SUPABASE_URL,
                        SUPABASE_KEY,
                        options=ClientOptions(headers={"Authorization": f"Bearer {auth_token}"})
                    )
                except Exception as ex:
                    logger.warning(f"Using default client: {ex}")

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
                logger.info(f"Resume saved to Supabase with ID: {supabase_record_id}")
        except Exception as db_err:
            logger.warning(f"Could not persist resume to Supabase table 'resumes': {db_err}")

    return {
        "status": "success",
        "file_name": file.filename,
        "raw_text_length": len(raw_text),
        "model_used": model_used,
        "saved_to_supabase": saved_to_supabase,
        "record_id": supabase_record_id,
        "user_id": effective_user_id,
        "parsed_resume": parsed_json,
        "raw_text_preview": raw_text[:300] + "..." if len(raw_text) > 300 else raw_text
    }

@app.get("/api/resume/latest")
def get_latest_resume(
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Retrieves the latest parsed resume for the authenticated user."""
    effective_user_id = get_authenticated_user_id(authorization, user_id)
    if not effective_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to fetch resume."
        )

    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured."
        )

    try:
        auth_token = authorization.replace("Bearer ", "").strip() if authorization else None
        db_client = supabase
        if auth_token:
            db_client = create_client(
                SUPABASE_URL,
                SUPABASE_KEY,
                options=ClientOptions(headers={"Authorization": f"Bearer {auth_token}"})
            )

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
        return {"status": "not_found", "resume": None}
    except Exception as e:
        logger.warning(f"Error querying resumes from Supabase: {e}")
        return {"status": "error", "message": str(e), "resume": None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
