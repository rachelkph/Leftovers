import { useState } from 'react';
import { sendSignInLink } from '../lib/auth';

/** Shown when cloud sync is on and nobody is signed in on this device. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await sendSignInLink(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t send the link. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <div className="onboarding__top">
          <span className="serif wordmark">leftovers</span>
        </div>
        {sent ? (
          <div className="onboarding__body">
            <h1 className="serif onboarding__title">
              check your <em>email.</em>
            </h1>
            <p className="meta">
              We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on this device and you’ll land back here, signed in.
            </p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setSent(false)}>
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form
            className="onboarding__body"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h1 className="serif onboarding__title">
              your fridge, on every <em>device.</em>
            </h1>
            <p className="meta">Sign in with your email and we’ll send you a link. No password to remember.</p>
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
                {busy ? 'Sending…' : 'Send sign-in link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
