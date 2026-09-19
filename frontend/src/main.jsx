import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.detail); else { setUser(data.user); await loadDocuments(data.user); }
    setBusy(false);
  }

  async function loadDocuments(owner = user) {
    const response = await fetch(`${API}/documents`, { headers: { "X-User": owner } });
    if (response.ok) setDocuments(await response.json());
  }

  async function upload(event) {
    event.preventDefault(); if (!file) return; setBusy(true); setMessage("");
    const body = new FormData(); body.append("file", file);
    const response = await fetch(`${API}/documents/upload`, { method: "POST", headers: { "X-User": user }, body });
    const data = await response.json();
    setMessage(response.ok ? "Document uploaded." : data.detail); setFile(null); await loadDocuments(); setBusy(false);
  }

  if (!user) return <main className="auth"><section><p className="eyebrow">DOCUMENT DESK</p><h1>Verify every file with confidence.</h1><p className="muted">Upload contracts and track document verification in one focused workspace.</p></section><form className="card" onSubmit={login}><p className="eyebrow">WELCOME BACK</p><h2>Sign in</h2><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required /><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required /><button disabled={busy}>{busy ? "Signing in..." : "Continue"}</button>{message && <p className="message">{message}</p>}<small>Demo: demo@example.com / password</small></form></main>;

  return <main className="workspace"><header><div><p className="eyebrow">DOCUMENT DESK</p><h1>Verification workspace</h1></div><button className="outline" onClick={() => { setUser(""); setDocuments([]); }}>Sign out</button></header><section className="grid"><form className="card" onSubmit={upload}><p className="eyebrow">NEW REVIEW</p><h2>Upload a document</h2><label className="drop">{file ? file.name : "Choose a PDF, DOCX, or image"}<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} required /></label><small>Maximum size: 10 MB.</small><button disabled={busy || !file}>Upload for verification</button>{message && <p className="message">{message}</p>}</form><section className="card"><div className="heading"><div><p className="eyebrow">ACTIVITY</p><h2>Your documents</h2></div><strong>{documents.length}</strong></div>{documents.length ? <ul>{documents.map(doc => <li key={doc.sha256}><span><b>{doc.filename}</b><small>{doc.uploaded_at}</small></span><em>{doc.status}</em></li>)}</ul> : <p className="muted">No documents yet.</p>}</section></section></main>;
}

createRoot(document.getElementById("root")).render(<App />);
