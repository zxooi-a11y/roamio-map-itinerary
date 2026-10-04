import { useState } from 'react';
import { useTrips } from '../../store/TripsProvider.jsx';

/**
 * Shown when this browser isn't signed in. Sign in once and the browser stays signed in,
 * so your trips are there on every device you've signed in on.
 */
export function SignInView() {
  const { signIn, signUp } = useTrips();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const creating = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (creating) {
        const result = await signUp(email.trim(), password);
        if (result.needsConfirmation) {
          setNotice('Account created. Check your email for a confirmation link, then come back here and sign in.');
          setMode('signin');
          setBusy(false);
        }
      } else {
        await signIn(email.trim(), password);
      }
      // On success the app reloads into the signed-in view, so this component goes away.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="splash auth">
      <h1 className="auth-title">Trip planner</h1>
      <p className="auth-sub">{creating ? 'Create your account to save trips across all your devices.' : 'Sign in to see your trips on this device.'}</p>
      <form className="auth-form" onSubmit={submit}>
        <label className="ad-lbl" htmlFor="auth-email">Email</label>
        <input className="ad-in" id="auth-email" type="email" required autoComplete="username" autoFocus
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="ad-lbl" htmlFor="auth-password">Password</label>
        <input className="ad-in" id="auth-password" type="password" required minLength={6}
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="import-error" role="alert">{error}</div>}
        {notice && <div className="auth-notice" role="status">{notice}</div>}
        <button className="btn auth-submit" type="submit" disabled={busy || !email || !password}>
          {busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <button className="ad-link auth-switch" type="button"
        onClick={() => { setMode(creating ? 'signin' : 'signup'); setError(''); setNotice(''); }}>
        {creating ? 'I already have an account' : 'First time? Create an account'}
      </button>
    </div>
  );
}
