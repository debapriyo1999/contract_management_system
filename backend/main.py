from datetime import datetime, timezone
from pathlib import Path
import hashlib
import secrets
import sqlite3
import uvicorn

from chatbot import answer_question, initialize_index
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Document Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DATABASE = BASE_DIR / "documents.db"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"}

def db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection

def initialize_database() -> None:
    with db_connection() as connection:
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documents (
                document_id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                status TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                owner TEXT NOT NULL REFERENCES users(email)
            );
        """)
        columns = {row[1] for row in connection.execute("PRAGMA table_info(documents)")}
        if "document_id" not in columns:
            connection.executescript("""
                CREATE TABLE documents_new (
                    document_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    stored_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    owner TEXT NOT NULL REFERENCES users(email)
                );
                INSERT INTO documents_new (filename, stored_name, status, uploaded_at, owner)
                    SELECT filename, stored_name, status, uploaded_at, owner FROM documents;
                DROP TABLE documents;
                ALTER TABLE documents_new RENAME TO documents;
            """)
        connection.execute("CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner)")

initialize_database()
initialize_index()

class LoginRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    question: str

def password_hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 100_000
    ).hex()

@app.post("/auth/signup")
def signup(request: LoginRequest) -> dict[str, str]:
    email = request.email.strip().lower()
    salt = secrets.token_hex(16)
    try:
        with db_connection() as connection:
            connection.execute(
                "INSERT INTO users (email, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
                (email, password_hash(request.password, salt), salt, datetime.now(timezone.utc).isoformat()),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    return {"user": email}

@app.post("/auth/login")
def login(request: LoginRequest) -> dict[str, str]:
    email = request.email.strip().lower()
    with db_connection() as connection:
        user = connection.execute(
            "SELECT email, password_hash, salt FROM users WHERE email = ?", (email,)
        ).fetchone()
    if not user or not secrets.compare_digest(
        password_hash(request.password, user["salt"]), user["password_hash"]
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"user": user["email"]}

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/documents")
def list_documents(x_user: str | None = Header(default=None)) -> list[dict]:
    if not x_user:
        raise HTTPException(status_code=401, detail="User header is required")
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT document_id, filename, stored_name, status, uploaded_at FROM documents WHERE owner = ? ORDER BY uploaded_at DESC",
            (x_user,),
        ).fetchall()
    return [dict(row) for row in rows]

@app.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    x_user: str | None = Header(default=None),
) -> dict[str, str]:
    if not x_user:
        raise HTTPException(status_code=401, detail="User header is required")
    with db_connection() as connection:
        document = connection.execute(
            "SELECT stored_name, status FROM documents WHERE document_id = ? AND owner = ?",
            (document_id, x_user),
        ).fetchone()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        if document["status"].lower() != "pending":
            raise HTTPException(status_code=409, detail="Only pending documents can be deleted")
        connection.execute("DELETE FROM documents WHERE document_id = ? AND owner = ?", (document_id, x_user))
    (UPLOAD_DIR / document["stored_name"]).unlink(missing_ok=True)
    with db_connection() as connection:
        connection.execute("DELETE FROM rag_chunks WHERE source = ? AND owner = ?", (f"document:{document_id}", x_user))
    return {"message": "Document deleted"}

@app.post("/chat/question")
def chat_question(
    request: ChatRequest,
    x_user: str | None = Header(default=None),
) -> dict:
    if not x_user:
        raise HTTPException(status_code=401, detail="User header is required")
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    return answer_question(x_user, question)

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

    document = {
        "filename": file.filename,
        "stored_name": "",
        "status": "Pending",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "owner": x_user,
    }
    with db_connection() as connection:
        connection.execute(
            "INSERT INTO documents (filename, stored_name, status, uploaded_at, owner) VALUES (?, ?, ?, ?, ?)",
            (document["filename"], document["stored_name"], document["status"], document["uploaded_at"], document["owner"]),
        )
        document_id = connection.execute("SELECT last_insert_rowid()").fetchone()[0]
        stored_name = f"{document_id}{extension}"
        connection.execute("UPDATE documents SET stored_name = ? WHERE document_id = ?", (stored_name, document_id))
    (UPLOAD_DIR / stored_name).write_bytes(content)
    document["document_id"] = document_id
    document["stored_name"] = stored_name
    return {key: value for key, value in document.items() if key != "owner"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
