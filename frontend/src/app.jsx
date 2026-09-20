import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthLayout } from "./components/AuthLayout";
import { DocumentList } from "./components/DocumentList";
import { LoginForm } from "./components/LoginForm";
import { UploadForm } from "./components/UploadForm";
import { fetchDocuments, loginUser, uploadDocument } from "./api";

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
      <AuthLayout>
        <LoginForm
          email={email}
          password={password}
          busy={busy}
          message={message}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
        />
      </AuthLayout>
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
        <UploadForm
          file={file}
          busy={busy}
          message={message}
          onFileChange={setFile}
          onSubmit={handleUpload}
        />
        <DocumentList documents={documents} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
