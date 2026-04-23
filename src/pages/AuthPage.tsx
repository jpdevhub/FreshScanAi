import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusTerminal from '../components/StatusTerminal';
import { api, setToken, isAuthenticated } from '../lib/api';

// Bypass token must match DEV_BYPASS_TOKEN in backend/.env
const DEV_BYPASS_TOKEN = 'dev-local-bypass-token';
const IS_DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export default function AuthPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Handle redirect from backend OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg('Authentication failed. Please try again.');
      window.history.replaceState({}, '', '/auth');
      return;
    }

    if (accessToken) {
      setStatus('processing');
      setToken(accessToken);
      // Clean the URL
      window.history.replaceState({}, '', '/auth');
      navigate('/mode', { replace: true });
      return;
    }

    // If already authenticated, skip straight to mode select
    if (isAuthenticated()) {
      navigate('/mode', { replace: true });
    }
  }, [navigate]);

  const handleGoogleLogin = () => {
    window.location.href = api.loginUrl();
  };

  /** Dev-only: skip OAuth entirely, store the bypass token, go straight to /mode */
  const handleDevLogin = () => {
    setToken(DEV_BYPASS_TOKEN);
    navigate('/mode', { replace: true });
  };

  const terminalMessages = (() => {
    if (status === 'processing') return ['AUTH_SUCCESS', 'REDIRECTING...'];
    if (status === 'error') return ['AUTH_ERROR', 'RETRY_REQUIRED'];
    return ['AUTHENTICATION', 'PROTOCOL: OAUTH-SECURE'];
  })();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-12 relative">
      <div className="watermark absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] text-[20rem]">
        AUTH
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-neon flex items-center justify-center">
              <span className="text-on-primary font-bold text-xl font-[family-name:var(--font-display)]">FS</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]">
                FRESHSCAN <span className="text-neon">AI</span>
              </h1>
            </div>
          </div>

          <StatusTerminal messages={terminalMessages} className="mb-4 justify-center" />

          {status === 'error' && (
            <p className="text-error text-sm mt-4 font-[family-name:var(--font-mono)]">
              {errorMsg}
            </p>
          )}

          {status === 'idle' && (
            <p className="text-on-surface-variant text-sm mt-4">
              Sign in to view your live Trust Map and sync biomarker data across devices.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <button
            type="button"
            disabled={status === 'processing'}
            onClick={handleGoogleLogin}
            className="w-full bg-surface-mid text-on-surface py-5 font-[family-name:var(--font-display)] font-semibold text-sm tracking-wide cursor-pointer transition-all duration-200 hover:bg-surface-high hover:border-outline ghost-border border-none flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {status === 'processing' ? 'AUTHENTICATING...' : 'CONTINUE_WITH_GOOGLE'}
          </button>

          {/* DEV ONLY — shown only when VITE_DEV_MODE=true in .env.local */}
          {IS_DEV_MODE && (
            <button
              type="button"
              onClick={handleDevLogin}
              className="w-full border border-dashed border-yellow-500/50 bg-yellow-500/5 text-yellow-400 py-4 font-[family-name:var(--font-mono)] text-xs tracking-widest cursor-pointer transition-all duration-200 hover:bg-yellow-500/10 hover:border-yellow-400 flex items-center justify-center gap-3"
            >
              <span className="text-yellow-500">⚡</span>
              DEV_LOGIN — BYPASS_OAUTH
              <span className="text-yellow-500/50 text-[10px]">[local only]</span>
            </button>
          )}
        </div>

        <div className="mt-12 pt-6 border-t border-outline-variant/15">
          <StatusTerminal
            messages={['SYS_STAT: ONLINE', 'UPTIME: 99.97%']}
            className="justify-center mt-4"
          />
        </div>
      </div>
    </div>
  );
}
