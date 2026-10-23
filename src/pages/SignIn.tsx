import { useState } from 'react';
import { sendSignInCode, verifySignInCode } from '../lib/auth';

/** Shown when cloud sync is on and nobody is signed in on this device: email, then a 6-digit code. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await sendSignInCode(email.trim());
      setCode('');
      setSent(true);
    }, 'We couldn’t send the code. Try again.');

  // On success the session changes and the app moves on by itself.
  const checkCode = () => run(() => verifySignInCode(email.trim(), code.trim()), 'That code didn’t work. Check it, or send a new one.');

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <div className="onboarding__top">
          <span className="serif wordmark">leftovers</span>
        </div>
        {sent ? (
          <form
            className="onboarding__body"
            onSubmit={(e) => {
              e.preventDefault();
              void checkCode();
            }}
          >
            <h1 className="serif onboarding__title">
              check your <em>email.</em>
            </h1>
            <p className="meta">
              We sent a sign-in code to <strong>{email.trim()}</strong>. Type it here — the code, not the link.
            </p>
            <label className="field">
              <span className="mono">Code</span>
              <input
                autoFocus
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
              />
            </label>
            {error && (
              <p className="meta" role="alert">
                {error}
              </p>
            )}
            <div className="btn-row btn-row--end">
              <button type="button" className="btn" disabled={busy} onClick={() => setSent(false)}>
                Back
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void sendCode()}>
                Send a new code
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy || code.trim().length < 6}>
                {busy ? 'Checking…' : 'Sign in'}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="onboarding__body"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <h1 className="serif onboarding__title">
              your fridge, on every <em>device.</em>
            </h1>
            <p className="meta">Sign in with your email. We’ll send you a short code — no password to remember.</p>
            <label className="field">
              <span className="mono">Email</span>
              <input type="email" autoFocus required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            {error && (
              <p className="meta" role="alert">
                {error}
              </p>
            )}
            <div className="btn-row btn-row--end">
              <button type="submit" className="btn btn--primary" disabled={busy || !email.trim()}>
                {busy ? 'Sending…' : 'Send code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
