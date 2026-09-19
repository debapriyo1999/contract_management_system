# Contract Management Starter

Minimal React frontend with a FastAPI document service.

## Requirements

Install Python 3.11+ and Node.js/npm. On restricted PowerShell systems, Node.js is assumed to be extracted to `$env:USERPROFILE\nodejs`.

## Run FastAPI

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The document service runs at `http://localhost:8000`.

## Run React frontend

```powershell
cd frontend
$env:Path = "$env:USERPROFILE\nodejs;$env:Path"
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Use `demo@example.com` with password `password`.

React handles the login page, upload form, and document list. FastAPI handles login validation, file validation, and storage. Documents are kept in memory and files are stored in `backend/uploads` for this simple example.
