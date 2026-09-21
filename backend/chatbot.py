from pathlib import Path
import hashlib
import json
import math
import os
import re
import sqlite3
from typing import Any

from datasets import load_dataset

BASE_DIR = Path(__file__).parent
DATABASE = BASE_DIR / "documents.db"
UPLOAD_DIR = BASE_DIR / "uploads"
VECTOR_SIZE = 512
CUAD_LIMIT = 250
CUAD_SOURCE_PREFIX = "cuad-v2:"


def connection() -> sqlite3.Connection:
    database = sqlite3.connect(DATABASE)
    database.row_factory = sqlite3.Row
    return database


def initialize_index() -> None:
    with connection() as database:
        database.execute("""
            CREATE TABLE IF NOT EXISTS rag_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                owner TEXT,
                content TEXT NOT NULL,
                vector TEXT NOT NULL,
                UNIQUE(source, owner)
            )
        """)


def tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def vectorize(text: str) -> list[float]:
    vector = [0.0] * VECTOR_SIZE
    for token in tokens(text):
        bucket = int.from_bytes(hashlib.sha256(token.encode()).digest()[:4], "big") % VECTOR_SIZE
        vector[bucket] += 1
    length = math.sqrt(sum(value * value for value in vector)) or 1
    return [value / length for value in vector]


def add_chunk(source: str, owner: str | None, content: str) -> None:
    content = content.strip()
    if not content:
        return
    with connection() as database:
        database.execute(
            "INSERT OR REPLACE INTO rag_chunks (source, owner, content, vector) VALUES (?, ?, ?, ?)",
            (source, owner, content, json.dumps(vectorize(content))),
        )


def _record_text(value: Any) -> str:
    if hasattr(value, "pages"):
        return "\n".join(page.extract_text() or "" for page in value.pages)
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(_record_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_record_text(item) for item in value)
    return str(value)


def index_cuad() -> None:
    if os.getenv("ENABLE_CUAD_INDEXING", "false").lower() != "true":
        with connection() as database:
            database.execute("DELETE FROM rag_chunks WHERE source LIKE 'cuad:%'")
            database.execute("DELETE FROM rag_chunks WHERE source LIKE ?", (f"{CUAD_SOURCE_PREFIX}%",))
        return

    with connection() as database:
        exists = database.execute(
            "SELECT 1 FROM rag_chunks WHERE source LIKE ? LIMIT 1",
            (f"{CUAD_SOURCE_PREFIX}%",),
        ).fetchone()
    if exists:
        return

    try:
        with connection() as database:
            database.execute("DELETE FROM rag_chunks WHERE source LIKE 'cuad:%'")
        dataset = load_dataset("theatticusproject/cuad", streaming=True)
        split = dataset["train"] if hasattr(dataset, "keys") else dataset
        for index, record in enumerate(split):
            text = _record_text(record)
            add_chunk(f"{CUAD_SOURCE_PREFIX}{index}", None, text)
            if index + 1 >= CUAD_LIMIT:
                break
    except Exception as error:
        print(f"CUAD indexing skipped: {error}")


def extract_file_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                return "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception:
            return ""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def index_uploaded_documents(owner: str) -> None:
    with connection() as database:
        documents = database.execute(
            "SELECT sha256, stored_name FROM documents WHERE owner = ?", (owner,)
        ).fetchall()
    for document in documents:
        path = UPLOAD_DIR / document["stored_name"]
        add_chunk(f"document:{document['sha256']}", owner, extract_file_text(path))


def similarity(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def generate_with_openai(question: str, matches: list[tuple[float, sqlite3.Row]]) -> str | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI

        client_options = {"api_key": api_key}
        base_url = os.getenv("OPENAI_BASE_URL")
        if base_url:
            client_options["base_url"] = base_url
        client = OpenAI(**client_options)
        context = "\n\n".join(
            f"Source: {row['source']}\n{row['content'][:5000]}"
            for _, row in matches
        )
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": "Answer contract questions only from the supplied context. If the context does not support an answer, say that the information was not found. Do not invent terms, dates, fees, or obligations.",
                },
                {
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion: {question}",
                },
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return None


def answer_question(owner: str, question: str) -> dict:
    initialize_index()
    index_uploaded_documents(owner)
    index_cuad()
    question_vector = vectorize(question)

    with connection() as database:
        rows = database.execute(
            "SELECT source, content, vector FROM rag_chunks WHERE owner IS NULL OR owner = ?",
            (owner,),
        ).fetchall()

    matches = sorted(
        ((similarity(question_vector, json.loads(row["vector"])), row) for row in rows),
        key=lambda item: item[0],
        reverse=True,
    )[:3]
    useful = [(score, row) for score, row in matches if score > 0]
    if not useful:
        return {"answer": "I could not find relevant information in the indexed contracts.", "sources": []}

    llm_answer = generate_with_openai(question, useful)
    if llm_answer:
        return {
            "answer": llm_answer,
            "sources": [
                {"source": row["source"], "score": round(score, 3)}
                for score, row in useful
            ],
            "llm": True,
        }

    _, best_row = useful[0]
    question_terms = set(tokens(question))
    sentences = re.split(r"(?<=[.!?])\s+", best_row["content"])
    sentence = max(
        sentences,
        key=lambda item: len(question_terms.intersection(tokens(item))),
        default=best_row["content"],
    ).strip()
    if not sentence:
        sentence = best_row["content"][:500]

    return {
        "answer": sentence[:800],
        "sources": [
            {"source": row["source"], "score": round(score, 3)}
            for score, row in useful
        ],
        "llm": False,
    }
