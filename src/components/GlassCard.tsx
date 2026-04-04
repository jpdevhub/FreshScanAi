import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'glass' | 'tonal' | 'void';
  hover?: boolean;
}

export default function GlassCard({
  children,
  className = '',
  variant = 'tonal',
  hover = false,
}: GlassCardProps) {
  const base = {
    glass: 'glass-panel',
    tonal: 'bg-surface-mid',
    void: 'bg-surface-lowest',
  }[variant];

  const hoverClass = hover
    ? 'transition-colors duration-200 hover:bg-surface-high cursor-pointer'
    : '';

  return (
    <div className={`${base} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}
