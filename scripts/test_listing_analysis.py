import json
import requests

BACKEND_URL = "http://127.0.0.1:8000"

# 1. First ensure sample resume is uploaded to populate the candidate resume profile
def ensure_resume_uploaded():
    print("--- [Step 1: Ensuring Active Resume Exists] ---")
    upload_url = f"{BACKEND_URL}/api/resume/upload"
    with open("sample_resume.pdf", "rb") as f:
        files = {"file": ("Alex_Rivera_Resume.pdf", f, "application/pdf")}
        data = {"user_id": "test-candidate-alex"}
        res = requests.post(upload_url, files=files, data=data)
    
    if res.status_code == 200:
        data = res.json()
        print(f"✅ Resume profile active for: {data.get('parsed_resume', {}).get('name')}")
        print(f"   Skills on record: {len(data.get('parsed_resume', {}).get('skills', []))} skills")
        return True
    else:
        print(f"❌ Failed to upload resume: {res.text}")
        return False

# 2. Test Listings
LISTING_1_FRONTEND = """
Company: Vercel
Title: Frontend Engineering Intern (Summer 2025)
Location: San Francisco, CA (Hybrid)

About the Role:
We are looking for a passionate Frontend Engineering Intern to join our Web Infrastructure and Dashboard team. You will work on cutting-edge developer experiences built on Next.js, React, and TypeScript.

Responsibilities:
- Build high-performance, accessible, and responsive user interfaces using Next.js App Router, React 19, and Tailwind CSS.
- Collaborate with designers and backend engineers to integrate REST and GraphQL APIs.
- Write robust unit and integration tests to ensure reliable deployments across global edge regions.
- Optimize client-side bundle performance and Core Web Vitals.

Qualifications:
- Currently pursuing a Bachelor's or Master's in Computer Science or related STEM field.
- Strong proficiency in modern JavaScript, TypeScript, React, and CSS/Tailwind.
- Familiarity with Next.js, Git, and automated testing tools (Jest, Playwright).
- Passion for developer tools and intuitive user experiences.
"""

LISTING_2_AI_BACKEND = """
Company: Scale AI
Title: AI Backend & Infrastructure Intern
Location: San Francisco, CA

About the Team:
Our Core Infrastructure team powers large-scale AI evaluation, data pipelines, and high-throughput agent workflows handling millions of requests daily.

Responsibilities:
- Design, build, and optimize asynchronous backend microservices using Python and FastAPI.
- Build high-concurrency caching and queuing layers with Redis and message brokers.
- Implement robust PostgreSQL database schemas and optimize query performance for large datasets.
- Containerize services with Docker and participate in deployment pipelines.
- Integrate with foundational LLM APIs (Gemini, Claude, GPT) to automate evaluations.

Requirements:
- Pursuing a degree in Computer Science, Software Engineering, or equivalent.
- Solid coding skills in Python, with experience in asynchronous frameworks like FastAPI or asyncio.
- Working knowledge of relational databases (PostgreSQL, SQL) and in-memory caches (Redis).
- Hands-on experience with Docker and Git version control.
- Curiosity about multi-agent systems and LLM orchestration.
"""

LISTING_3_EMBEDDED = """
Company: Tesla
Title: Embedded Firmware & Vehicle Systems Intern
Location: Palo Alto, CA

Role Overview:
Join the Vehicle Firmware Engineering team working directly on microcontrollers, battery management systems, and safety-critical real-time vehicle controls.

Responsibilities:
- Develop low-level firmware in Embedded C and ARM assembly for STM32 and TI microcontrollers.
- Interface with hardware peripherals using SPI, I2C, CAN bus, and UART protocols.
- Debug hardware and timing issues using oscilloscopes, logic analyzers, and JTAG emulators.
- Implement FreeRTOS tasks with strict microsecond timing requirements.

Requirements:
- Enrolled in Electrical Engineering, Computer Engineering, or Mechatronics program.
- Deep knowledge of C, memory management, pointers, and bitwise manipulation.
- Experience reading hardware schematics and using bench equipment (oscilloscopes, multimeters).
- Hands-on experience with RTOS or bare-metal microcontroller programming.
"""

def test_analyze_listing(listing_text: str, label: str):
    print(f"\n========================================================")
    print(f"Testing Analysis for: {label}")
    print(f"========================================================")

    url = f"{BACKEND_URL}/api/listing/analyze"
    payload = {
        "description": listing_text,
        "user_id": "test-candidate-alex"
    }

    res = requests.post(url, json=payload)
    if res.status_code != 200:
        print(f"❌ Analysis failed: {res.status_code} - {res.text}")
        return None

    data = res.json()
    listing = data.get("listing", {})

    print(f"✅ Company: {listing.get('company')} | Role: {listing.get('title')}")
    print(f"🎯 Fit Score: {listing.get('fit_score')}/100")
    print(f"🔍 Matching Skills ({len(listing.get('fit_reasoning', {}).get('matching_skills', []))}): {listing.get('fit_reasoning', {}).get('matching_skills')}")
    print(f"⚠️  Missing Skills / Gaps: {listing.get('fit_reasoning', {}).get('missing_skills')}")
    print(f"💪 Strengths Observed:")
    for s in listing.get('fit_reasoning', {}).get('strengths', []):
        print(f"   • {s}")
    print(f"\n✉️ Generated Outreach Message:")
    print("--------------------------------------------------------")
    print(listing.get('outreach_draft'))
    print("--------------------------------------------------------")

    return listing

def test_status_update(listing_id: str):
    print(f"\n--- [Testing Status Update for Listing {listing_id[:8]}...] ---")
    url = f"{BACKEND_URL}/api/listing/{listing_id}/status"
    
    # 1. Mark as applied
    res1 = requests.patch(url, json={"status": "applied"})
    print(f"Status update to 'applied': {res1.status_code}")

    # 2. Mark as replied
    res2 = requests.patch(url, json={"status": "replied"})
    print(f"Status update to 'replied': {res2.status_code}")

def test_list_all():
    print(f"\n--- [Testing GET /api/listings] ---")
    url = f"{BACKEND_URL}/api/listings?user_id=test-candidate-alex"
    res = requests.get(url)
    if res.status_code == 200:
        items = res.json().get("listings", [])
        print(f"✅ Found {len(items)} tracked listings in user account:")
        for it in items:
            print(f"   • [{it.get('status').upper()}] {it.get('company')} - {it.get('title')} (Fit Score: {it.get('fit_score')}%)")
    else:
        print(f"❌ Failed to list listings: {res.text}")

if __name__ == "__main__":
    if ensure_resume_uploaded():
        l1 = test_analyze_listing(LISTING_1_FRONTEND, "Listing 1: Vercel Frontend Intern")
        l2 = test_analyze_listing(LISTING_2_AI_BACKEND, "Listing 2: Scale AI Backend/AI Intern")
        l3 = test_analyze_listing(LISTING_3_EMBEDDED, "Listing 3: Tesla Embedded Firmware Intern")

        if l1 and "id" in l1:
            test_status_update(l1["id"])

        test_list_all()
