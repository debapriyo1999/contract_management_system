from datetime import datetime, timezone
from pathlib import Path
import hashlib

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Document Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"}
DOCUMENTS: list[dict] = []

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(request: LoginRequest) -> dict[str, str]:
    if request.email != "demo@example.com" or request.password != "password":
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"user": request.email}

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/documents")
def list_documents(x_user: str | None = Header(default=None)) -> list[dict]:
    if not x_user:
        raise HTTPException(status_code=401, detail="User header is required")
    return [document for document in DOCUMENTS if document["owner"] == x_user]

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    x_user: str | None = Header(default=None),
) -> dict:
    if not x_user:
        raise HTTPException(status_code=401, detail="User header is required")
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File is larger than 10 MB")

    file_hash = hashlib.sha256(content).hexdigest()
    stored_name = f"{file_hash}{extension}"
    (UPLOAD_DIR / stored_name).write_bytes(content)
    document = {
        "filename": file.filename,
        "stored_name": stored_name,
        "sha256": file_hash,
        "status": "Pending",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "owner": x_user,
    }
    DOCUMENTS.append(document)
    return {key: value for key, value in document.items() if key != "owner"}
