import { Link, useLocation } from 'react-router-dom';
import StatusTerminal from './StatusTerminal';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { to: '/', label: 'HOME' },
    { to: '/scanner', label: 'SCANNER' },
    { to: '/map', label: 'TRUST_MAP' },
    { to: '/results', label: 'RESULTS' },
  ];

  return (
    <nav className="glass-panel fixed top-0 left-0 right-0 z-50 border-b border-outline-variant/15">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="w-8 h-8 bg-neon flex items-center justify-center">
            <span className="text-on-primary font-bold text-sm font-[family-name:var(--font-display)]">FS</span>
          </div>
          <span className="font-[family-name:var(--font-display)] font-bold text-lg tracking-tight text-tertiary">
            FRESHSCAN<span className="text-neon">_AI</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-[family-name:var(--font-mono)] text-xs tracking-widest no-underline transition-colors duration-200 ${
                location.pathname === link.to
                  ? 'text-neon'
                  : 'text-on-surface-variant hover:text-tertiary'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Status Terminal */}
        <div className="hidden lg:block">
          <StatusTerminal messages={['SYS_STAT: ONLINE', 'LATENCY: 12ms']} />
        </div>

        {/* Auth Button */}
        <Link
          to="/auth"
          className="hidden md:flex items-center gap-2 bg-neon text-on-primary px-5 py-2.5 font-[family-name:var(--font-display)] font-bold text-sm tracking-wide no-underline transition-all duration-200 hover:bg-neon-dim"
        >
          INITIALIZE_SESSION
        </Link>
      </div>
    </nav>
  );
}
