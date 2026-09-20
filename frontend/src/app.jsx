import { useState } from "react";
import { createRoot } from "react-dom/client";

const API = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

const loginUser = (email, password) => request("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});

const fetchDocuments = (owner) => request("/documents", {
  headers: { "X-User": owner }
});

const uploadDocument = (owner, file) => {
  const body = new FormData();
  body.append("file", file);
  return request("/documents/upload", {
    method: "POST",
    headers: { "X-User": owner },
    body
  });
};

function Login({ email, password, busy, message, setEmail, setPassword, onSubmit }) {
  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="eyebrow">WELCOME BACK</p>
      <h2>Sign in</h2>
      <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <button disabled={busy}>{busy ? "Signing in..." : "Continue"}</button>
      {message && <p className="message">{message}</p>}
      <small>Demo: demo@example.com / password</small>
    </form>
  );
}

function Upload({ file, busy, message, setFile, onSubmit }) {
  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="eyebrow">NEW REVIEW</p>
      <h2>Upload a document</h2>
      <label className="drop">
        {file ? file.name : "Choose a PDF, DOCX, or image"}
        <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files[0])} required />
      </label>
      <small>Maximum size: 10 MB.</small>
      <button disabled={busy || !file}>Upload</button>
      {message && <p className="message">{message}</p>}
    </form>
  );
}

function Documents({ documents }) {
  return (
    <section className="card">
      <div className="heading"><h2>Documents</h2><strong>{documents.length}</strong></div>
      {documents.length ? <ul>{documents.map((doc) => (
        <li key={doc.sha256}>
          <span><b>{doc.filename}</b><small>{doc.uploaded_at}</small></span>
          <em>{doc.status}</em>
        </li>
      ))}</ul> : <p className="muted">No documents yet.</p>}
    </section>
  );
}

function App() {
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDocuments = async (owner = user) => {
    if (!owner) return;
    const items = await fetchDocuments(owner);
    setDocuments(items);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const data = await loginUser(email, password);
      setUser(data.user);
      await loadDocuments(data.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setMessage("");

    try {
      await uploadDocument(user, file);
      setMessage("Document uploaded.");
      setFile(null);
      await loadDocuments();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    setUser("");
    setDocuments([]);
    setMessage("");
    setEmail("");
    setPassword("");
  };

  if (!user) {
    return (
      <main className="auth">
        <section>
          <p className="eyebrow">DOCUMENT DESK</p>
          <h1>Verify every file with confidence.</h1>
          <p className="muted">Upload contracts and track verification in one workspace.</p>
        </section>
        <Login {...{ email, password, busy, message, setEmail, setPassword }} onSubmit={handleLogin} />
      </main>
    );
  }

  return (
    <main>
      <header className="header">
        <div>
          <p className="eyebrow">DOCUMENT DESK</p>
          <h1>Verification workspace</h1>
        </div>
        <button className="outline" onClick={handleSignOut}>Sign out</button>
      </header>

      <section className="grid">
        <Upload {...{ file, busy, message, setFile }} onSubmit={handleUpload} />
        <Documents documents={documents} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
