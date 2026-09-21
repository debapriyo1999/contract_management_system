from pathlib import Path
import hashlib
import json
import math
import os
import re
import sqlite3

BASE_DIR = Path(__file__).parent
DATABASE = BASE_DIR / "documents.db"
UPLOAD_DIR = BASE_DIR / "uploads"
CHUNK_SIZE = 900
CHUNK_OVERLAP = 120
EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
CHAT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def connection() -> sqlite3.Connection:
    database = sqlite3.connect(DATABASE)
    database.row_factory = sqlite3.Row
    return database


def initialize_index() -> None:
    with connection() as database:
        database.execute("""
            CREATE TABLE IF NOT EXISTS rag_chunks (
                chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                owner TEXT,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding TEXT NOT NULL,
                UNIQUE(source, chunk_index, owner)
            )
        """)
        columns = {row[1] for row in database.execute("PRAGMA table_info(rag_chunks)")}
        if "embedding" not in columns:
            database.execute("DROP TABLE rag_chunks")
            database.execute("""
                CREATE TABLE rag_chunks (
                    chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    owner TEXT,
                    chunk_index INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    UNIQUE(source, chunk_index, owner)
                )
            """)


def chunks(text: str) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    return [
        clean[start:start + CHUNK_SIZE]
        for start in range(0, len(clean), CHUNK_SIZE - CHUNK_OVERLAP)
        if clean[start:start + CHUNK_SIZE].strip()
    ]


def fallback_embedding(text: str) -> list[float]:
    vector = [0.0] * 512
    for token in re.findall(r"[a-z0-9]+", text.lower()):
        bucket = int.from_bytes(hashlib.sha256(token.encode()).digest()[:4], "big") % len(vector)
        vector[bucket] += 1
    length = math.sqrt(sum(value * value for value in vector)) or 1
    return [value / length for value in vector]


def embeddings(texts: list[str]) -> list[list[float]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return [fallback_embedding(text) for text in texts]

    from openai import OpenAI

    options = {"api_key": api_key}
    if os.getenv("OPENAI_BASE_URL"):
        options["base_url"] = os.environ["OPENAI_BASE_URL"]
    response = OpenAI(**options).embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def replace_source(source: str, owner: str | None, text: str) -> int:
    parts = chunks(text)
    if not parts:
        return 0
    vectors = embeddings(parts)
    with connection() as database:
        database.execute("DELETE FROM rag_chunks WHERE source = ? AND owner IS ?", (source, owner))
        database.executemany(
            "INSERT INTO rag_chunks (source, owner, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?)",
            [(source, owner, index, part, json.dumps(vector)) for index, (part, vector) in enumerate(zip(parts, vectors))],
        )
    return len(parts)


def extract_file_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    if path.suffix.lower() == ".docx":
        from docx import Document
        return "\n".join(paragraph.text for paragraph in Document(path).paragraphs)
    return path.read_text(encoding="utf-8", errors="ignore")


def index_uploaded_document(document_id: int, owner: str, stored_name: str) -> int:
    text = extract_file_text(UPLOAD_DIR / stored_name)
    return replace_source(f"document:{document_id}", owner, text)


def index_user_documents(owner: str) -> int:
    with connection() as database:
        documents = database.execute(
            "SELECT document_id, stored_name FROM documents WHERE owner = ?",
            (owner,),
        ).fetchall()
    return sum(
        index_uploaded_document(document["document_id"], owner, document["stored_name"])
        for document in documents
    )


def record_text(record: dict) -> str:
    pdf = record.get("pdf")
    if hasattr(pdf, "pages"):
        return "\n".join(page.extract_text() or "" for page in pdf.pages)
    return " ".join(str(value) for value in record.values() if isinstance(value, str))


def cosine(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def retrieve(owner: str, question: str, limit: int = 5) -> list[tuple[float, sqlite3.Row]]:
    query_vector = embeddings([question])[0]
    with connection() as database:
        rows = database.execute(
            "SELECT source, content, embedding FROM rag_chunks WHERE owner IS NULL OR owner = ?",
            (owner,),
        ).fetchall()
    return sorted(
        ((cosine(query_vector, json.loads(row["embedding"])), row) for row in rows),
        key=lambda item: item[0],
        reverse=True,
    )[:limit]


def ask_chatgpt(question: str, matches: list[tuple[float, sqlite3.Row]]) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return matches[0][1]["content"][:800]

    from openai import OpenAI

    options = {"api_key": api_key}
    if os.getenv("OPENAI_BASE_URL"):
        options["base_url"] = os.environ["OPENAI_BASE_URL"]
    context = "\n\n".join(f"[{row['source']}]\n{row['content']}" for _, row in matches)
    response = OpenAI(**options).chat.completions.create(
        model=CHAT_MODEL,
        temperature=0,
        messages=[
            {"role": "system", "content": "Answer only from the provided contract context. If it is insufficient, say so. Cite the source IDs used."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
        ],
    )
    return response.choices[0].message.content.strip()


def answer_question(owner: str, question: str) -> dict:
    initialize_index()
    index_user_documents(owner)
    matches = retrieve(owner, question)
    if not matches or matches[0][0] <= 0:
        return {"answer": "No indexed contract context was found. Upload and index a document first.", "sources": []}
    return {
        "answer": ask_chatgpt(question, matches),
        "sources": [{"source": row["source"], "score": round(score, 3)} for score, row in matches],
        "llm": bool(os.getenv("OPENAI_API_KEY")),
    }
