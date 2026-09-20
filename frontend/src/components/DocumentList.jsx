export function DocumentList({ documents }) {
  return (
    <section className="card">
      <div className="heading">
        <h2>Documents</h2>
        <strong>{documents.length}</strong>
      </div>

      {documents.length ? (
        <ul>
          {documents.map((doc) => (
            <li key={doc.sha256}>
              <span>
                <b>{doc.filename}</b>
                <small>{doc.uploaded_at}</small>
              </span>
              <em>{doc.status}</em>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No documents yet.</p>
      )}
    </section>
  );
}
