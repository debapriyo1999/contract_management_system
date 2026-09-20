export function UploadForm({ file, busy, message, onFileChange, onSubmit }) {
  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="eyebrow">NEW REVIEW</p>
      <h2>Upload a document</h2>
      <label className="drop">
        {file ? file.name : "Choose a PDF, DOCX, or image"}
        <input
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(event) => onFileChange(event.target.files[0])}
          required
        />
      </label>
      <small>Maximum size: 10 MB.</small>
      <button disabled={busy || !file}>Upload</button>
      {message && <p className="message">{message}</p>}
    </form>
  );
}
