import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { api, clearToken, isAuthenticated } from '../lib/api';
import type { UserProfile } from '../lib/types';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loggedIn) {
      api.getMe().then(setProfile).catch(console.error);
    } else {
      setProfile(null);
    }
  }, [loggedIn]);

  useEffect(() => {
    const handleAuthChange = () => setLoggedIn(isAuthenticated());
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    clearToken();
    navigate('/');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const links = [
    { to: '/', label: 'HOME' },
    { to: '/scanner', label: 'SCANNER' },
    { to: '/map', label: 'TRUST_MAP' },
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
              className={`font-[family-name:var(--font-mono)] text-xs tracking-widest no-underline transition-colors duration-200 ${location.pathname === link.to
                ? 'text-neon'
                : 'text-on-surface-variant hover:text-tertiary'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth Button & Modal */}
        {loggedIn ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 bg-surface-low border border-outline-variant/30 text-on-surface px-3 py-1.5 transition-all duration-200 hover:bg-surface-mid ghost-border"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} referrerPolicy="no-referrer" alt="Profile" className="w-7 h-7 rounded-full object-cover grayscale-[0.5] contrast-125 border border-neon/30" />
              ) : (
                <div className="w-7 h-7 bg-surface-highest flex items-center justify-center text-neon text-xs font-bold font-[family-name:var(--font-display)]">
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
              )}
              <span className="text-sm font-[family-name:var(--font-mono)] tracking-wider mr-1 uppercase">
                {profile?.full_name ? profile.full_name.split(' ')[0] : 'SESSION'}
              </span>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-surface-low border border-outline-variant/30 shadow-2xl p-2 flex flex-col gap-1 z-50">
                <Link
                  to="/results"
                  onClick={() => setIsDropdownOpen(false)}
                  className="px-4 py-3 text-sm font-[family-name:var(--font-display)] font-bold text-on-surface-variant hover:text-neon hover:bg-surface-high no-underline transition-colors duration-200 block"
                >
                  RESULTS
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-3 text-sm font-[family-name:var(--font-display)] font-bold text-error text-left hover:bg-error/10 transition-colors duration-200 block w-full"
                >
                  TERMINATE_SESSION (LOGOUT)
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/auth"
            className="flex items-center gap-2 bg-neon text-on-primary px-3 py-1.5 md:px-5 md:py-2.5 font-[family-name:var(--font-display)] font-bold text-xs md:text-sm tracking-wide no-underline transition-all duration-200 hover:bg-neon-dim"
          >
            SIGN_IN / SIGN_UP
          </Link>
        )}
      </div>

      {/* Logout Toast Notification */}
      <div
        className={`fixed top-20 right-6 bg-surface-mid border border-outline-variant/30 px-6 py-4 glass-panel z-50 flex items-center gap-3 transition-all duration-300 transform ${showToast ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}
      >
        <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
        <span className="font-[family-name:var(--font-mono)] text-xs tracking-widest text-on-surface">SESSION_TERMINATED</span>
      </div>
    </nav>
  );
}
