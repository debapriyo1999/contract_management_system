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

## Legacy manual startup

The backend can also be started after activating the environment:

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```
