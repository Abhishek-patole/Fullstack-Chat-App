import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type GoogleAuthButtonProps = {
  onCredential: (credential: string) => void;
  isLoading: boolean;
  label: string;
};

const GOOGLE_SCRIPT_ID = "google-identity-services-script";

const GoogleAuthButton = ({ onCredential, isLoading, label }: GoogleAuthButtonProps) => {
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || !buttonRef.current) return;

    const initializeButton = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            onCredential(response.credential);
          }
        },
      });

      buttonRef.current &&
        window.google?.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "continue_with",
        });
    };

    if (window.google?.accounts?.id) {
      initializeButton();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeButton;

    if (!existingScript) {
      document.head.appendChild(script);
    }

    return () => {
      // Keep the script cached for route changes; only the button node is recreated.
    };
  }, [onCredential]);

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    return <div className="text-sm text-base-content/60">Google sign-in is not configured.</div>;
  }

  return (
    <div className="space-y-2">
      <div ref={buttonRef} />
      {isLoading ? <div className="text-xs text-base-content/50">{label}</div> : null}
    </div>
  );
};

export default GoogleAuthButton;