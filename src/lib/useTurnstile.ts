import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => number;
      execute: (widgetId: number) => void;
      reset: (widgetId: number) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

async function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existingScript) {
      if ((existingScript as HTMLScriptElement).dataset.loaded === 'true') {
        return resolve();
      }
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Turnstile script.')));
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Turnstile script.'));
    document.head.appendChild(script);
  });
}

export default function useTurnstile(siteKey: string | undefined) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const pendingRef = useRef<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!siteKey) {
      setReady(false);
      return;
    }

    let canceled = false;

    async function setup() {
      try {
        await loadTurnstileScript();
        if (canceled) return;
        if (!window.turnstile || !containerRef.current) {
          throw new Error('Turnstile is unavailable in this environment.');
        }

        if (widgetIdRef.current === null) {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            size: 'normal',

            callback: (token: string) => {
              const pending = pendingRef.current;
              pending?.resolve(token);
              pendingRef.current = null;
            },

            'error-callback': () => {
              const pending = pendingRef.current;
              pending?.reject(new Error('Turnstile verification failed.'));
              pendingRef.current = null;
            },

            'expired-callback': () => {
              const pending = pendingRef.current;
              pending?.reject(
                new Error('Turnstile token expired. Please verify again.')
              );
              pendingRef.current = null;
            },
          });
        }
        setReady(true);
      } catch (err) {
        if (!canceled) {
          const loadError = err instanceof Error ? err : new Error('Unknown Turnstile load error');
          setError(loadError);
          setReady(false);
        }
      }
    }

    setup();

    return () => {
      canceled = true;
    };
  }, [siteKey]);

  const execute = async (): Promise<string> => {
    if (!siteKey) {
      throw new Error('Turnstile site key is not configured.');
    }
    if (error) {
      throw error;
    }
    if (!ready || widgetIdRef.current === null) {
      throw new Error('Turnstile is not ready yet. Please wait and try again.');
    }

    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      try {
        window.turnstile?.execute(widgetIdRef.current as number);
      } catch (exc) {
        pendingRef.current = null;
        reject(exc instanceof Error ? exc : new Error('Turnstile execution failed.'));
      }
    });
  };

  return { containerRef, ready, execute, error };
}
