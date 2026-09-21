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

const askQuestion = (owner, question) => request("/chat/question", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-User": owner },
  body: JSON.stringify({ question })
});

const deleteDocument = (owner, documentId) => request(`/documents/${documentId}`, {
  method: "DELETE",
  headers: { "X-User": owner }
});

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
    <form className="card upload-card" onSubmit={onSubmit}>
      <div className="upload-heading">
        <div>
          <p className="eyebrow">NEW REVIEW</p>
          <h2>Upload a document</h2>
        </div>
        <span className="file-limit">10 MB max</span>
      </div>
      <label className="drop">
        <span className="upload-icon">+</span>
        <strong>{file ? file.name : "Choose a file to review"}</strong>
        <small>{file ? "File selected and ready to upload" : "PDF, DOCX, PNG, or JPG"}</small>
        <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files[0])} required />
      </label>
      <button className="primary" disabled={busy || !file}>{busy ? "Uploading..." : "Upload document"}</button>
      {message && <p className="message">{message}</p>}
    </form>
  );
}

function Documents({ user, documents, onDelete }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const handleQuestion = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;
    setChatBusy(true);
    setAnswer("");
    try {
      const result = await askQuestion(user, question);
      setAnswer(result.answer);
    } catch (error) {
      setAnswer(error.message);
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="heading"><div><p className="eyebrow">YOUR FILES</p><h2>Documents</h2></div><strong className="count">{documents.length}</strong></div>
      {documents.length ? <ul>{documents.map((doc) => (
        <li key={doc.document_id}>
          <span><b>{doc.filename}</b><small>{doc.uploaded_at}</small></span>
          <span className="document-actions">
            <em>{doc.status}</em>
            {doc.status.toLowerCase() === "pending" && <button className="delete-button" onClick={() => onDelete(doc.document_id)}>Delete</button>}
          </span>
        </li>
      ))}</ul> : <p className="muted">No documents yet.</p>}

      <form className="chat-box" onSubmit={handleQuestion}>
        <p className="eyebrow">ASK YOUR CONTRACTS</p>
        <h3>Ask a question</h3>
        <div className="chat-input">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What are the payment terms?" />
          <button className="primary" disabled={chatBusy || !question.trim()}>{chatBusy ? "Thinking..." : "Ask"}</button>
        </div>
        {answer && <p className="answer">{answer}</p>}
      </form>
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

  const handleDelete = async (documentId) => {
    try {
      await deleteDocument(user, documentId);
      await loadDocuments();
      setMessage("Pending document deleted.");
    } catch (error) {
      setMessage(error.message);
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
        <Documents user={user} documents={documents} onDelete={handleDelete} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
