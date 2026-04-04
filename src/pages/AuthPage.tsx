import { Link } from 'react-router-dom';
import StatusTerminal from '../components/StatusTerminal';

export default function AuthPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-12 relative">
      {/* Watermark */}
      <div className="watermark absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] text-[20rem]">
        AUTH
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
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

          <StatusTerminal
            messages={['AUTHENTICATION', 'PROTOCOL: OAUTH-SECURE']}
            className="mb-4 justify-center"
          />

          <p className="text-on-surface-variant text-sm mt-4">
            Sign in to view your live Trust Map and sync biomarker data across devices.
          </p>
        </div>

        {/* OAuth Button Area */}
        <div className="space-y-4">
          <button
            type="button"
            className="w-full bg-surface-mid text-on-surface py-5 font-[family-name:var(--font-display)] font-semibold text-sm tracking-wide cursor-pointer transition-all duration-200 hover:bg-surface-high hover:border-outline ghost-border border-none flex items-center justify-center gap-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            CONTINUE_WITH_GOOGLE
          </button>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-outline-variant/15">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {['PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'SYSTEM_STATUS'].map((link) => (
              <Link
                key={link}
                to="#"
                className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant no-underline hover:text-neon transition-colors"
              >
                {link}
              </Link>
            ))}
          </div>
          <StatusTerminal
            messages={['SYS_STAT: ONLINE', 'UPTIME: 99.97%']}
            className="justify-center mt-4"
          />
        </div>
      </div>
    </div>
  );
}
