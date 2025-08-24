from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path
import os
import requests
import re

# ---------------- Env & Paths ----------------
load_dotenv()

# IMPORTANT: paths are computed so FastAPI can find CRA build/
# Repo root = parent of backend/
BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
BUILD_DIR = REPO_ROOT / "build"               # CRA output (npm run build)
BUILD_STATIC = BUILD_DIR / "static"
INDEX_HTML = BUILD_DIR / "index.html"

# Environment variables
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")
HF_API_KEY = os.getenv("HF_API_KEY") or os.getenv("HF_TOKEN")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
SECRET_KEY = os.getenv("SECRET_KEY") or JWT_SECRET_KEY  # use either
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Novita router (HF) compatible OpenAI-style chat completions
API_URL = "https://router.huggingface.co/novita/v3/openai/chat/completions"

# ---------------- Mongo ----------------
if not MONGO_URI:
    raise RuntimeError("MONGO_URI (or MONGODB_URI) is not set")

client = AsyncIOMotorClient(MONGO_URI)
db = client["focusbot"]
chat_collection = db["chats"]
user_collection = db["users"]

# ---------------- Security ----------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY (or JWT_SECRET_KEY) must be set")

# ---------------- App ----------------
app = FastAPI(
    title="FocusBot Backend (Single Service)",
    description="Serves React build and provides /api endpoints",
    version="1.1.0"
)

# CORS: Not strictly needed when frontend is served by the same app.
# Keep permissive for dev; tighten by setting FRONTEND_ORIGIN later if desired.
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN")  # e.g., https://your-domain.onrender.com
if FRONTEND_ORIGIN:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# --------- Health (API) ----------
@app.get("/api/health")
def api_health():
    return {"ok": True, "time": datetime.utcnow().isoformat()}

# --------- Root API Info ----------
@app.get("/api")
def api_root():
    return {"message": "FocusBot API is live", "version": "1.1.0"}

# ---------- Auth Helpers ----------
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# ---------- Signup ----------
@app.post("/api/signup")
async def signup(request: Request):
    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "").strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    existing = await user_collection.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    hashed_pw = hash_password(password)
    await user_collection.insert_one({"email": email, "hashed_password": hashed_pw})

    token = create_access_token({"sub": email})
    return {"token": token}

# ---------- Login ----------
@app.post("/api/login")
async def login(request: Request):
    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "").strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = await user_collection.find_one({"email": email})
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": email})
    return {"token": token}

# ---------- Chat ----------
@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message", "").strip()
    subject = body.get("subject", "").strip()

    # Default user = guest
    user = "guest"

    # Optional: check JWT if provided
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user = payload.get("sub", "guest")
        except JWTError:
            pass  # ignore invalid token, keep as guest

    if not message or not subject:
        return JSONResponse(status_code=400, content={"error": "Both message and subject are required."})

    # Check if this is the first message in the conversation
    conversation_started = body.get("conversation_started", False)

    # System prompt
    if not conversation_started:
        system_prompt = (
            f"You are a helpful tutor for {subject}. Start by greeting the user warmly and briefly "
            f"introducing yourself as their {subject} tutor. Then ask how you can help them with {subject} today. "
            f"Keep it friendly and encouraging."
        )
    else:
        system_prompt = (
            f"You are a helpful tutor specialized in {subject}. Your role is to help students with {subject}-related topics. "
            f"If a student asks about topics unrelated to {subject}, politely redirect them to {subject} topics "
            f"and suggest relevant {subject} questions they could ask instead. "
            f"Always be encouraging and helpful, even when redirecting. "
            f"Answer {subject} questions clearly and briefly."
        )

    if not HF_API_KEY:
        return JSONResponse(status_code=500, content={"error": "HF_API_KEY/HF_TOKEN is not set"})

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ],
        "model": "deepseek/deepseek-r1-turbo"
    }

    response = requests.post(API_URL, headers=headers, json=payload, timeout=120)

    if response.status_code != 200:
        return JSONResponse(
            status_code=502,
            content={"error": f"HF API error: {response.status_code}", "details": response.text},
        )

    try:
        data = response.json()
        raw_reply = data["choices"][0]["message"]["content"]
        cleaned_reply = re.sub(r"<think>.*?</think>", "", raw_reply, flags=re.DOTALL).strip()

        # Determine if this was a redirect/apology based on content analysis
        lowered = cleaned_reply.lower()
        is_redirect = any(phrase in lowered for phrase in [
            "apologize", "sorry", "currently focused", "unrelated", "redirect",
            "instead", "related to", "focused on"
        ])

        # Only save valid conversations (not rejected ones)
        if not is_redirect:
            chat_doc = {
                "user": user,
                "subject": subject,
                "message": message,
                "reply": cleaned_reply,
                "timestamp": datetime.utcnow(),
                "rejected": False
            }
            await chat_collection.insert_one(chat_doc)

        return {"reply": cleaned_reply}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to parse response: {e}"})

# ---------- History ----------
@app.get("/api/history")
async def history(user: str = "guest", subject: str | None = None):
    query = {"user": user, "rejected": {"$ne": True}}
    if subject:
        query["subject"] = subject

    cursor = chat_collection.find(query).sort("timestamp", -1).limit(50)
    history_list = []
    async for doc in cursor:
        timestamp = doc.get("timestamp")
        formatted_time = timestamp.strftime("%b %d, %Y at %I:%M %p") if timestamp else ""
        history_list.append({
            "id": str(doc["_id"]),
            "subject": doc.get("subject"),
            "message": doc.get("message"),
            "reply": doc.get("reply"),
            "timestamp": doc.get("timestamp").isoformat() if timestamp else None,
            "formatted_time": formatted_time,
            "rejected": False
        })
    return {"history": history_list}

@app.delete("/api/history/{chat_id}")
async def delete_chat_history(chat_id: str, user: str = "guest"):
    try:
        from bson import ObjectId
        result = await chat_collection.delete_one({"_id": ObjectId(chat_id), "user": user})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Chat not found.")
        return {"message": "Chat deleted successfully"}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chat ID")

@app.delete("/api/history")
async def clear_all_history(user: str = "guest"):
    result = await chat_collection.delete_many({"user": user})
    return {"message": f"Deleted {result.deleted_count} chats"}

# ---------- Subjects Management ----------
@app.post("/api/subjects")
async def add_subject(request: Request):
    body = await request.json()
    subject_name = body.get("subject", "").strip()
    user = body.get("user", "guest")

    if not subject_name:
        raise HTTPException(status_code=400, detail="Subject name is required.")

    existing = await db["user_subjects"].find_one({"user": user, "subject": subject_name})
    if existing:
        raise HTTPException(status_code=400, detail="Subject already exists.")

    await db["user_subjects"].insert_one({
        "user": user,
        "subject": subject_name,
        "created_at": datetime.utcnow()
    })
    return {"message": "Subject added successfully"}

@app.get("/api/subjects")
async def get_subjects(user: str = "guest"):
    default_subjects = ["Math", "History", "Science", "Literature"]
    cursor = db["user_subjects"].find({"user": user})
    custom_subjects = [doc["subject"] async for doc in cursor]
    return {"subjects": default_subjects + custom_subjects}

@app.delete("/api/subjects/{subject}")
async def delete_subject(subject: str, user: str = "guest"):
    if subject in ["Math", "History", "Science", "Literature"]:
        raise HTTPException(status_code=400, detail="Cannot delete default subjects.")
    result = await db["user_subjects"].delete_one({"user": user, "subject": subject})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found.")
    return {"message": "Subject deleted successfully"}

# ------------- Serve React Build -------------
# Mount the CRA build at root. API routes above take precedence.
if BUILD_DIR.exists():
    app.mount("/", StaticFiles(directory=str(BUILD_DIR), html=True), name="frontend")

# Optional: explicit root route (useful before the first build)
@app.get("/")
def root():
    if INDEX_HTML.exists():
        return FileResponse(str(INDEX_HTML))
    return {"message": "FocusBot backend running! Build the React app to serve the UI."}

# ------------- Local Dev Entrypoint -------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
