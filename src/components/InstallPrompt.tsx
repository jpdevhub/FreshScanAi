import { useState, useEffect } from 'react';

type PromptType = "ios" | "android" | null;

const IOSMsg = "Add FreshScan AI to your Home Screen for one-tap fish freshness analysis. Tap Share and select Add to Home Screen."
const AndroidMsg = "Add FreshScan AI to your home screen for instant fish freshness analysis in one tap."

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
    standalone?: boolean;
}

export default function InstallPrompt() {
    const [promptType, setpromptType] = useState<PromptType>(() => {
        if (typeof window === 'undefined') return null;

        const userAgent = navigator.userAgent || navigator.vendor || '';
        const ios = /iphone|ipad|ipod/i.test(userAgent);
        const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as NavigatorWithStandalone).standalone;

        return (ios && !standalone) ? "ios" : null;
    });
    
    const [showInstallPrompt, setShowInstallPrompt] = useState(() => {
        return promptType === "ios";
    });
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const userAgent = navigator.userAgent || navigator.vendor || '';
        const handler = (e: Event) => {
            e.preventDefault();

            const installEvent = e as BeforeInstallPromptEvent;

            const isMobileOrTablet = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
            const hasTouchScreen = window.matchMedia('(pointer: coarse)').matches;

            if (isMobileOrTablet && hasTouchScreen) {
                setpromptType("android");
                setDeferredPrompt(installEvent);
                setShowInstallPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler as EventListener);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler as EventListener);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        try {
            await deferredPrompt.prompt();

            const choiceResult = await deferredPrompt.userChoice;

            if (choiceResult.outcome === 'accepted') {
                console.log('User installed the PWA!');
            } else {
                console.log('User dismissed the install dialog.');
            }
        } catch (err) {
            console.error("Error triggering the install prompt:", err);
        }

        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    const handleNotNow = () => {
        setShowInstallPrompt(false);
    };

    const renderFunction = (Message: string) => {
        return (
            <div
                className="fixed bottom-5 left-5 right-5 max-w-sm z-[9999] border-4 border-black bg-gray-800 p-5 shadow-[8px_8px_0px_0px_black]"
            >
                <div className="flex items-center gap-4 border-b-4 border-black pb-4">
                    <img
                        src="/fish.gif"
                        alt="FreshScan AI"
                        width={56}
                        height={56}
                    />

                    <div>
                        <p className="text-xs font-black tracking-widest uppercase">
                            FreshScan AI
                        </p>

                        <h2 className="text-xl font-black uppercase">
                            Install App
                        </h2>
                    </div>
                </div>

                <p className="mt-4 text-base font-bold leading-relaxed">
                    {Message}
                </p>

                <div className="mt-5 flex gap-3">
                    {(promptType == 'android') && (
                        <button
                            onClick={handleInstallClick}
                            className="flex-1 border-4 border-black bg-lime-300 px-4 py-3 text-black uppercase shadow-[4px_4px_0px_0px_black] active:translate-x-1 active:translate-y-1 active:shadow-none"
                        >
                            Install
                        </button>
                    )}

                    <button
                        onClick={handleNotNow}
                        className="px-4 py-3 font-black uppercase"
                    >
                        Not Now
                    </button>
                </div>
            </div>
        )
    }

    const message = promptType === 'ios' ? IOSMsg : AndroidMsg;
    return (
        <>
            {showInstallPrompt && renderFunction(message)}
        </>
    );
}