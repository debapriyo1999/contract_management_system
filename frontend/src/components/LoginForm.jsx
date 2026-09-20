export function LoginForm({ email, password, busy, message, onEmailChange, onPasswordChange, onSubmit }) {
  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="eyebrow">WELCOME BACK</p>
      <h2>Sign in</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        required
      />
      <button disabled={busy}>{busy ? "Signing in..." : "Continue"}</button>
      {message && <p className="message">{message}</p>}
      <small>Demo: demo@example.com / password</small>
    </form>
  );
}
