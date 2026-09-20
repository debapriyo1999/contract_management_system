import { useState } from "react";
import { createRoot } from "react-dom/client";

const API = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  try {
    const response = await fetch(`${API}${path}`, options);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : {};
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  } catch (error) {
    throw new Error(error instanceof TypeError ? "Cannot connect to the backend. Start FastAPI on port 8000." : error.message);
  }
}

const authenticate = (mode, email, password) => request(`/auth/${mode === "signup" ? "signup" : "login"}`, {
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

function AuthPanel({ mode, setMode, email, password, busy, message, setEmail, setPassword, onSubmit }) {
  return (
    <form className="card auth-card" onSubmit={onSubmit}>
      <div className="auth-switch">
        {mode === "login" ? "New here?" : "Already have an account?"}
        <button type="button" className="link-button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Create account" : "Sign in"}
        </button>
      </div>
      <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "NEW ACCOUNT"}</p>
      <h2>{mode === "login" ? "Sign in" : "Register"}</h2>
      <label>Email address<input type="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <button className="primary" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
      {message && <p className="message">{message}</p>}
      <small>{mode === "login" ? "Use your registered email and password." : "Your account is stored locally in SQLite."}</small>
    </form>
  );
}

function Upload({ file, busy, message, setFile, onSubmit }) {
  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="eyebrow">NEW REVIEW</p>
      <h2>Upload a document</h2>
      <label className="drop">
        <span className="upload-icon">+</span>
        <strong>{file ? file.name : "Choose a file to review"}</strong>
        <small>PDF, DOCX, PNG, or JPG / up to 10 MB</small>
        <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files[0])} required />
      </label>
      <button className="primary" disabled={busy || !file}>{busy ? "Uploading..." : "Upload document"}</button>
      {message && <p className="message">{message}</p>}
    </form>
  );
}

function Documents({ documents }) {
  return (
    <section className="card">
      <div className="heading"><div><p className="eyebrow">YOUR FILES</p><h2>Documents</h2></div><strong className="count">{documents.length}</strong></div>
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
  const [mode, setMode] = useState("login");
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
      const data = await authenticate(mode, email, password);
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
        <AuthPanel {...{ mode, setMode, email, password, busy, message, setEmail, setPassword }} onSubmit={handleLogin} />
      </main>
    );
  }

  return (
    <main>
      <header className="header">
        <div>
          <p className="eyebrow">DOCUMENT DESK · {user}</p>
          <h1>Verification workspace</h1>
        </div>
        <button className="outline signout" onClick={handleSignOut}>Sign out</button>
      </header>

      <section className="grid">
        <Upload {...{ file, busy, message, setFile }} onSubmit={handleUpload} />
        <Documents documents={documents} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
