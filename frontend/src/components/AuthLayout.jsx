export function AuthLayout({ children }) {
  return (
    <main className="auth">
      <section>
        <p className="eyebrow">DOCUMENT DESK</p>
        <h1>Verify every file with confidence.</h1>
        <p className="muted">Upload contracts and track verification in one workspace.</p>
      </section>
      {children}
    </main>
  );
}
