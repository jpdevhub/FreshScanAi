import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { api, isAuthenticated } from '../lib/api';

/**
 * Listens to React Router route changes and fires a PostHog $pageview event
 * on every navigation. This is required for SPAs since the page never
 * actually reloads between routes.
 */
export default function PostHogPageView() {

    const location = useLocation();
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture('$pageview', {
      $current_url: window.location.href,
    });
  }, [location, posthog]);

  // Identify user on load and on auth-change
  useEffect(() => {
    const identifyUser = async () => {
      if (isAuthenticated()) {
        try {
          const profile = await api.getMe();
          posthog?.identify(profile.id, {
            email: profile.email,
            name: profile.full_name,
          });
        } catch (err) {
          console.error("Failed to identify user with backend", err);
        }
      }
    };

    // Run on initial load if returning user
    identifyUser();

    // Run whenever the token is set or cleared
    window.addEventListener('auth-change', identifyUser);
    return () => window.removeEventListener('auth-change', identifyUser);
  }, [posthog]);

  return null;
}

