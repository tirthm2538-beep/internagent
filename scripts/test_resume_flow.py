import io
import json
import os
import requests
import pypdf

def create_sample_resume_pdf(output_path: str):
    """Generates a complete, realistic PDF resume with experience, skills, education, and projects."""
    lines = [
        "Alex Rivera",
        "Email: alex.rivera@gmail.com | Phone: (415) 555-0199 | San Francisco, CA",
        "LinkedIn: linkedin.com/in/alexrivera-dev | GitHub: github.com/alexrivera-code",
        "",
        "SUMMARY",
        "Aspiring Software Engineer and Computer Science senior with production experience in Python, FastAPI,",
        "React, and distributed systems. Passionate about AI-driven automation and developer tooling.",
        "",
        "SKILLS",
        "Languages: Python, TypeScript, JavaScript, SQL, C++, HTML, CSS",
        "Frameworks & Libraries: FastAPI, Next.js, React, Node.js, Tailwind CSS, PyTorch",
        "Tools & Infrastructure: Docker, Git, PostgreSQL, Supabase, Redis, AWS (S3, Lambda)",
        "",
        "EXPERIENCE",
        "Software Engineering Intern | TechNova Labs | Jun 2024 - Aug 2024",
        "- Built asynchronous REST APIs in FastAPI handling 20,000+ daily requests with 99.9% uptime.",
        "- Implemented caching layer using Redis, reducing database latency by 42%.",
        "- Collaborated in an Agile sprint team of 6 engineers using Git, Jira, and CI/CD pipelines.",
        "",
        "Full Stack Developer Intern | CloudScale Systems | Jan 2024 - May 2024",
        "- Developed responsive analytics dashboards using Next.js 14, React, and Tailwind CSS.",
        "- Engineered real-time WebSocket connection to stream live IoT telemetry metrics to client UI.",
        "- Authored unit and integration test suites using Jest and Pytest, boosting test coverage to 88%.",
        "",
        "EDUCATION",
        "Bachelor of Science in Computer Science | University of California, Berkeley",
        "Expected Graduation: May 2025 | GPA: 3.82 / 4.0",
        "Relevant Coursework: Data Structures, Algorithms, Database Systems, Computer Security, Machine Learning",
        "",
        "PROJECTS",
        "TaskFlow AI - Automated Workflow Orchestrator | github.com/alexrivera-code/taskflow-ai",
        "- Architected multi-agent task runner in Python utilizing Gemini API and Celery queue workers.",
        "- Implemented secure user authentication and data persistence with Supabase PostgreSQL and Row Level Security.",
        "",
        "DevMetrics - GitHub PR & Velocity Dashboard | github.com/alexrivera-code/dev-metrics",
        "- Built fullstack developer dashboard in TypeScript and Next.js pulling GitHub GraphQL API metrics.",
        "- Visualized team code velocity, review turnaround times, and merge bottlenecks."
    ]

    # Build clean PDF stream
    stream_lines = ["BT", "/F1 10 Tf", "50 750 Td"]
    first = True
    for line in lines:
        sanitized = line.replace("(", "\\(").replace(")", "\\)")
        if first:
            stream_lines.append(f"({sanitized}) Tj")
            first = False
        else:
            stream_lines.append(f"0 -14 Td ({sanitized}) Tj")
    stream_lines.append("ET")
    stream_content = "\n".join(stream_lines).encode("latin-1")

    pdf_parts = [
        b"%PDF-1.4\n",
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
        f"4 0 obj << /Length {len(stream_content)} >> stream\n".encode("latin-1"),
        stream_content,
        b"\nendstream\nendobj\n",
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
        b"xref\n0 6\n0000000000 65535 f \n",
        b"0000000009 00000 n \n",
        b"0000000058 00000 n \n",
        b"0000000115 00000 n \n",
        b"0000000244 00000 n \n",
        f"{244 + 40 + len(stream_content):010d} 00000 n \n".encode("latin-1"),
        b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n",
        f"{244 + 40 + len(stream_content) + 70}\n%%EOF".encode("latin-1")
    ]

    with open(output_path, "wb") as f:
        for part in pdf_parts:
            f.write(part)

    print(f"Generated sample resume PDF at: {output_path}")

def test_upload_endpoint(pdf_path: str):
    """Sends the PDF resume to the FastAPI backend /api/resume/upload endpoint."""
    backend_url = "http://127.0.0.1:8000/api/resume/upload"
    print(f"\nTesting endpoint: {backend_url}")

    with open(pdf_path, "rb") as f:
        files = {"file": (os.path.basename(pdf_path), f, "application/pdf")}
        data = {"user_id": "test-user-12345"}
        response = requests.post(backend_url, files=files, data=data)

    print(f"Response status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print("\n✅ Resume Successfully Uploaded & Parsed!")
        print(f"Candidate Name: {result.get('parsed_resume', {}).get('name')}")
        print(f"Model Used: {result.get('model_used')}")
        print(f"Raw Text Length: {result.get('raw_text_length')} characters")
        print(f"Skills Extracted ({len(result.get('parsed_resume', {}).get('skills', []))}): {result.get('parsed_resume', {}).get('skills')}")
        print(f"Experience Count: {len(result.get('parsed_resume', {}).get('experience', []))}")
        print(f"Education: {result.get('parsed_resume', {}).get('education')}")
        print(f"Projects: {len(result.get('parsed_resume', {}).get('projects', []))}")
        print(f"Saved to Supabase: {result.get('saved_to_supabase')}")
        return result
    else:
        print(f"❌ Upload failed with error: {response.text}")
        return None

if __name__ == "__main__":
    sample_pdf = "sample_resume.pdf"
    create_sample_resume_pdf(sample_pdf)

    # Verify pypdf can read it
    reader = pypdf.PdfReader(sample_pdf)
    text = "".join([page.extract_text() or "" for page in reader.pages])
    print(f"pypdf successfully extracted {len(text)} characters from {sample_pdf}")

    # Test the API endpoint
    test_upload_endpoint(sample_pdf)
