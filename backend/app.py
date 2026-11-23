import os
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="InternAgent API",
    description="Backend API for InternAgent - AI Internship Hunting Assistant",
    version="0.1.0"
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "InternAgent Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0"
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to the InternAgent API. Visit /health for status or /docs for API documentation."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
