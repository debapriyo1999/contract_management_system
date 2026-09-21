# Contract Management Starter

Minimal React frontend with a FastAPI document service and local SQLite storage.

## Requirements

Install Python 3.11+ and Node.js/npm. Python includes the `sqlite3` module, so the application does not need a separate SQLite server. On restricted PowerShell systems, Node.js is assumed to be extracted to `$env:USERPROFILE\nodejs`.

The backend creates `backend/documents.db` automatically on first start. It contains `users` and `documents` tables. Uploaded files are stored in `backend/uploads`.

## First-time setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..\frontend
$env:Path = "$env:USERPROFILE\nodejs;$env:Path"
npm.cmd install
```

If PowerShell blocks activation, run the backend with the virtual environment's executable directly:

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

## Start the backend

Open a terminal in the project folder and run:

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

The document service runs at `http://localhost:8000`.

## Start the frontend

Open a second terminal in the project folder and run:

```powershell
cd frontend
$env:Path = "$env:USERPROFILE\nodejs;$env:Path"
npm.cmd run dev
```

Open `http://localhost:5173`.

Use **Create account** once, then use **Sign in** with the same email and password. Accounts and document metadata remain available after restarting the backend because they are stored in SQLite.

## Restart the system

1. Stop each running terminal with `Ctrl+C`.
2. Start the backend again:

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

3. In a second terminal, start the frontend again:

```powershell
cd frontend
$env:Path = "$env:USERPROFILE\nodejs;$env:Path"
npm.cmd run dev
```

4. Reopen `http://localhost:5173` and sign in.

## Optional SQLite inspection

From the project folder, the SQLite command-line tool can inspect the database:

```powershell
cd backend
sqlite3 documents.db
```

Then run SQL commands such as:

```sql
.tables
SELECT email, created_at FROM users;
SELECT filename, status, uploaded_at FROM documents;
.quit
```

Do not delete `documents.db` unless you intentionally want to remove all registered users and document metadata.

## API behavior

React handles the sign-in, account creation, upload form, and document list. FastAPI handles password hashing, SQLite queries, file validation, and storage. Passwords are stored as salted PBKDF2-SHA256 hashes rather than plain text.

## Starter SOW chatbot dataset

The file `datasets/sow_qa.jsonl` contains six synthetic Statements of Work with grounded question-answer examples. It is safe for development testing and includes scope, deliverables, timelines, fees, assumptions, exclusions, and service terms.

This is a starter dataset, not legal advice or a substitute for approved company contracts. For production use, add only contracts that you are authorized to process, remove confidential personal information, and preserve document identifiers so chatbot answers can cite their source.

For a document question-answering chatbot, use the uploaded SOW text as the retrieval source and use the included QA pairs for evaluation. Retrieval-augmented generation (RAG) is generally a better fit than training a model from scratch for a small or changing contract library.

## Contract chatbot

The chatbot is implemented in `backend/chatbot.py`. It uses a SQLite-backed vector index with deterministic hashed text vectors. On each question it indexes the signed-in user's uploaded documents, then retrieves the most similar chunks. If `OPENAI_API_KEY` is configured, those retrieved chunks are sent to the selected OpenAI-compatible chat model for a grounded response. Without a key, the chatbot uses a local extractive fallback.

CUAD indexing is optional because the Hugging Face CUAD repository contains many large contract PDFs and can be slow or unavailable on a restricted network. Enable it only when required with `$env:ENABLE_CUAD_INDEXING = "true"`; uploaded documents remain the primary chatbot knowledge source by default.

To enable OpenAI generation for the backend process:

```powershell
$env:OPENAI_API_KEY = "your-api-key"
$env:OPENAI_MODEL = "gpt-4o-mini"
.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

For an OpenAI-compatible external provider, also set `OPENAI_BASE_URL` to that provider's chat API base URL. Never commit API keys to the repository. The retrieved contract context is sent to the configured provider, so confirm that your data-sharing and privacy requirements allow this.

The document list includes an **Ask a question** form. Only documents with `Pending` status can be deleted; deletion removes both the stored file and its database metadata.

## Legacy manual startup

The backend can also be started after activating the environment:

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```
