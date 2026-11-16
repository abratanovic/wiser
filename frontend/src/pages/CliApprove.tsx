import {useState} from 'react';
import {useSearchParams} from 'react-router';
import {SiteHeader} from '@/components/SiteHeader';
import {useAuth} from '@/contexts/AuthContext.shared';
import {approveCliLogin} from '@/lib/api';

// shortcut: English only; this page is for the account owner's own terminal, add i18n strings
// if it is ever shown to students.
export function CliApprove() {
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const {token, isAuthenticated, login} = useAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const approve = async () => {
    if (!token) return;
    setState('busy');
    try {
      await approveCliLogin(token, code);
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  };

  const signIn = () => {
    // Google sign-in is a full-page round trip; AuthCallback brings us back here afterwards.
    try {
      sessionStorage.setItem('returnTo', `/cli?code=${encodeURIComponent(code)}`);
    } catch {
      /* the owner just reopens the link */
    }
    login();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Authorize the wiser CLI</h1>
        <p className="font-mono text-2xl tracking-widest text-foreground">{code || '—'}</p>

        {!code ? (
          <p className="text-sm text-muted-foreground">No code in this link. Run <code>wiser login</code> again.</p>
        ) : state === 'done' ? (
          <p className="text-sm text-foreground">Approved. You can close this tab; the terminal is signed in.</p>
        ) : !isAuthenticated ? (
          <>
            <p className="text-sm text-muted-foreground">Sign in to approve this code.</p>
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              onClick={signIn}>
              Continue with Google
            </button>
            <p className="text-xs text-muted-foreground">
              Use email and password? Sign in on the <a className="underline" href="/">main page</a>, then open this link again.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              A command-line tool will get lasting read and write access to your timetable and events.
              Approve only if you started <code>wiser login</code> yourself just now and the code matches your terminal.
            </p>
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={state === 'busy'}
              onClick={approve}>
              {state === 'busy' ? 'Approving…' : 'Approve'}
            </button>
            {state === 'error' && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
      </main>
    </div>
  );
}
