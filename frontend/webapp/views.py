from pathlib import Path

import httpx
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import redirect, render


def login_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    if request.method == "POST":
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")
        if email == "demo@example.com" and password == "password":
            user, created = User.objects.get_or_create(username=email, defaults={"email": email})
            if created:
                user.set_password(password)
                user.save()
        user = authenticate(request, username=email, password=password)
        if user is not None:
            from django.contrib.auth import login
            login(request, user)
            return redirect("dashboard")
        messages.error(request, "Invalid email or password.")
    return render(request, "login.html")

@login_required
def dashboard(request):
    try:
        response = httpx.get(f"{settings.FASTAPI_URL}/documents", headers={"X-User": request.user.email}, timeout=5)
        response.raise_for_status()
        documents = response.json()
    except httpx.HTTPError:
        documents = []
        messages.error(request, "The document service is unavailable.")
    return render(request, "dashboard.html", {"documents": documents})

@login_required
def upload(request):
    if request.method == "POST" and request.FILES.get("file"):
        uploaded = request.FILES["file"]
        try:
            response = httpx.post(
                f"{settings.FASTAPI_URL}/documents/upload",
                headers={"X-User": request.user.email},
                files={"file": (Path(uploaded.name).name, uploaded.file, uploaded.content_type)},
                timeout=30,
            )
            if response.is_success:
                messages.success(request, "Document uploaded for verification.")
            else:
                messages.error(request, response.json().get("detail", "Upload failed."))
        except httpx.HTTPError:
            messages.error(request, "The document service is unavailable.")
    else:
        messages.error(request, "Choose a document first.")
    return redirect("dashboard")

@login_required
def logout_view(request):
    from django.contrib.auth import logout
    logout(request)
    return redirect("login")
