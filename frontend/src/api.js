const API = "http://127.0.0.1:8000";

export async function loginUser(email, password) {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Login failed");
  return data;
}

export async function fetchDocuments(owner) {
  const response = await fetch(`${API}/documents`, {
    headers: { "X-User": owner }
  });

  if (!response.ok) throw new Error("Unable to load documents");
  return response.json();
}

export async function uploadDocument(owner, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API}/documents/upload`, {
    method: "POST",
    headers: { "X-User": owner },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Upload failed");
  return data;
}
