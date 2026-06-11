import { useState, useEffect } from "react";
import OnboardingTour from "./components/OnboardingTour";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import ModeSelectPage from './pages/ModeSelectPage';
import ScannerPage from './pages/ScannerPage';
import AnalysisDashboard from './pages/AnalysisDashboard';
import MarketMapPage from './pages/MarketMapPage';
import ResultsPage from './pages/ResultsPage';
import Leaderboard from './pages/Leaderboard';
import PostHogPageView from './components/PostHogPageView';
import NotFound from './pages/NotFound';
import InstallPrompt from './components/InstallPrompt';
import PublicReport from "./pages/PublicReport";

export default function App() {
  const [runTour, setRunTour] = useState(false);

useEffect(() => {
  const completed = localStorage.getItem("tour-completed");

  if (!completed) {
    setTimeout(() => {
      setRunTour(true);
      localStorage.setItem("tour-completed", "true");
    }, 0);
  }
}, []);
  return (
    <BrowserRouter>
      {/* Toast provider for global error notifications */}
      <OnboardingTour run={runTour} />
      <Toaster position="bottom-right" />
      
      {/* Fires a $pageview event to PostHog on every SPA route change */}
      <PostHogPageView />
      <InstallPrompt />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/mode" element={<ModeSelectPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/analysis" element={<AnalysisDashboard />} />
          <Route path="/map" element={<MarketMapPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/results" element={<ResultsPage />} />
          
          {/* Public shareable report — MUST be before the * catchall */}
          <Route path="/report/:id" element={<PublicReport />} />

          {/* Catch-all route for broken links/404s */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}