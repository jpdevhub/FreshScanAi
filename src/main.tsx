import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.tsx'
import { initTheme } from './lib/theme';

// Initialize theme before rendering the app to prevent flicker
initTheme();

// PostHog is only initialized when the key is present.
// Contributors running locally without the key will have it silently disabled.
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: '2026-01-30',
    // Loads async — won't block rendering
    loaded: (ph) => {
      // Disable in dev so local sessions don't pollute the dashboard
      if (import.meta.env.DEV) ph.opt_out_capturing();
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)