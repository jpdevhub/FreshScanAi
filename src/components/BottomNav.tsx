import { Link, useLocation } from 'react-router-dom';
import { ScanLine, Map, Layers, Languages, SunMoon } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { toggleTheme } from '../lib/theme';

const navItems = [
  { to: '/scanner', icon: ScanLine, label: 'SCANNER' },
  { to: '/map', icon: Map, label: 'MAP' },
  { to: '/mode', icon: Layers, label: 'MODE' },
];

export default function BottomNav() {
  const location = useLocation();
  const { i18n } = useTranslation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-outline-variant/15">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 no-underline transition-colors duration-200 ${isActive ? 'text-neon' : 'text-on-surface-variant'
                }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest">
                {label}
              </span>
            </Link>
          );
        })}
                <button
          type="button"
          onClick={toggleTheme}
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-neon transition-colors duration-200"
          aria-label="Toggle theme"
        >
          <SunMoon size={20} strokeWidth={1.5} />
          <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest">
            THEME
          </span>
        </button>

        <label className="flex flex-col items-center gap-1 text-on-surface-variant">
          <Languages size={20} strokeWidth={1.5} />
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-transparent font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest outline-none"
            aria-label="Change language"
          >
            <option value="en">EN</option>
            <option value="hi">HI</option>
            <option value="bn">BN</option>
          </select>
        </label>
      </div>
    </nav>
  );
}
