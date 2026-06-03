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
import PostHogPageView from './components/PostHogPageView';
import NotFound from './pages/NotFound';
// Import the context wrapper
import { ComparisonProvider } from './context/ComparisonContext';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" />
      <PostHogPageView />
      
      {/* Wrap everything cleanly inside the ComparisonProvider */}
      <ComparisonProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/mode" element={<ModeSelectPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/analysis" element={<AnalysisDashboard />} />
            <Route path="/map" element={<MarketMapPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ComparisonProvider>
    </BrowserRouter>
  );
}