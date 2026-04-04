export default function Footer() {
  return (
    <footer className="relative z-10 w-full border-t border-outline-variant/20">
      <div className="max-w-7xl mx-auto px-6 md:px-16 lg:px-24 py-5 md:py-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">

        {/* Brand — status-terminal style, slightly larger */}
        <span className="status-terminal" style={{ fontSize: '0.8125rem' }}>
          FreshScan_AI
        </span>

        {/* Copyright — matches body paragraph (text-on-surface-variant) */}
        <p className="text-on-surface-variant text-sm leading-relaxed text-center sm:text-right m-0">
          © 2026 FreshScan AI. All rights reserved. Precision Intelligence.
        </p>

      </div>
    </footer>
  );
}
