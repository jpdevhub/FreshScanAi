import { Link, useLocation } from 'react-router-dom';
import { ScanLine, Map, BarChart3, User } from 'lucide-react';

const navItems = [
  { to: '/scanner', icon: ScanLine, label: 'SCANNER' },
  { to: '/map', icon: Map, label: 'MAP' },
  { to: '/results', icon: BarChart3, label: 'RESULTS' },
  { to: '/auth', icon: User, label: 'PROFILE' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-outline-variant/15">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 no-underline transition-colors duration-200 ${
                isActive ? 'text-neon' : 'text-on-surface-variant'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
