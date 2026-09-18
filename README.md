# Contract Management Starter

A small application with a Django web frontend and FastAPI document service.

## Requirements

Install Python 3.11+. Node.js and npm are not required.

## Run FastAPI

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The document service runs at `http://localhost:8000`.

## Run Django frontend

```powershell
cd frontend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8001
```

Open `http://localhost:8001`. Use `demo@example.com` with password `password`.

Django handles login and HTML pages. FastAPI handles document validation and storage. Documents are kept in memory and files are stored in `backend/uploads` for this simple example.
