import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="relative min-h-screen bg-bg overflow-hidden">
      {/* Dot Grid Background */}
      <div className="dot-grid fixed inset-0 pointer-events-none z-0" />

      {/* FS_AI Watermark */}
      <div className="watermark fixed -right-8 top-1/4 select-none pointer-events-none z-0">
        FS_AI
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Page Content */}
      <main className="relative z-10 pt-16 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
