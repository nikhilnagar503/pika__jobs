import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  generateGoogleNonce,
  googleClientId,
  loadGoogleIdentity,
  renderGoogleButton,
} from "@/lib/google-identity";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function StyledGoogleButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-ghost google-signin-face"
      onClick={onClick}
      disabled={loading}
      tabIndex={onClick ? 0 : -1}
      aria-hidden={!onClick}
    >
      <GoogleMark />
      {loading ? "Connecting…" : label}
    </button>
  );
}

function fitGoogleHitArea(parent: HTMLElement) {
  const iframe = parent.querySelector("iframe");
  if (!iframe) return;
  const sourceWidth = iframe.offsetWidth || 400;
  const sourceHeight = iframe.offsetHeight || 40;
  const scaleX = parent.offsetWidth / sourceWidth;
  const scaleY = parent.offsetHeight / sourceHeight;
  iframe.style.position = "absolute";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.transform = `scale(${scaleX}, ${scaleY})`;
  iframe.style.transformOrigin = "0 0";
}

export function GoogleSignInButton({
  next,
  label,
  onError,
}: {
  next: string;
  label: string;
  onError: (message: string) => void;
}) {
  const { signInWithGoogle, signInWithGoogleIdToken } = useAuth();
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  const signInRef = useRef(signInWithGoogleIdToken);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const clientId = googleClientId();
  onErrorRef.current = onError;
  signInRef.current = signInWithGoogleIdToken;

  useEffect(() => {
    if (!clientId || !host.current) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;

    async function mount() {
      try {
        const { nonce, hashedNonce } = await generateGoogleNonce();
        await loadGoogleIdentity();
        if (cancelled || !host.current) return;
        const width = Math.min(wrap.current?.offsetWidth || 400, 400);
        renderGoogleButton(
          host.current,
          {
            client_id: clientId,
            nonce: hashedNonce,
            ux_mode: "popup",
            use_fedcm_for_prompt: true,
            auto_select: false,
            callback: async (response) => {
              try {
                await signInRef.current(response.credential, nonce);
              } catch (err) {
                onErrorRef.current(err instanceof Error ? err.message : "Could not sign in with Google.");
              }
            },
          },
          {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            width,
            logo_alignment: "left",
          },
        );
        const parent = host.current;
        if (!parent) return;
        requestAnimationFrame(() => fitGoogleHitArea(parent));
        observer = new ResizeObserver(() => fitGoogleHitArea(parent));
        observer.observe(parent);
      } catch (err) {
        if (!cancelled) {
          onErrorRef.current(err instanceof Error ? err.message : "Could not start Google sign-in.");
        }
      }
    }

    void mount();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <div className="google-signin">
        <StyledGoogleButton
          label={label}
          loading={fallbackLoading}
          onClick={async () => {
            setFallbackLoading(true);
            onError("");
            try {
              await signInWithGoogle(next);
            } catch (err) {
              onError(err instanceof Error ? err.message : "Could not sign in with Google.");
              setFallbackLoading(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div ref={wrap} className="google-signin">
      <StyledGoogleButton label={label} loading={false} />
      <div ref={host} className="google-signin-hit" />
    </div>
  );
}
