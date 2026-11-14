import { GOOGLE_CLIENT_ID } from "@/lib/config";

const GSI_SRC = "https://accounts.google.com/gsi/client";

type GoogleIdConfig = {
  client_id: string;
  callback: (response: { credential: string }) => void;
  nonce?: string;
  ux_mode?: "popup" | "redirect";
  use_fedcm_for_prompt?: boolean;
  auto_select?: boolean;
};

type GoogleButtonConfig = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
  logo_alignment?: "left" | "center";
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          renderButton: (parent: HTMLElement, config: GoogleButtonConfig) => void;
        };
      };
    };
  }
}

let gsiLoader: Promise<void> | null = null;

export function googleClientId() {
  return GOOGLE_CLIENT_ID;
}

export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoader) return gsiLoader;

  gsiLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Google sign-in.")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiLoader = null;
      reject(new Error("Could not load Google sign-in."));
    };
    document.head.appendChild(script);
  });

  return gsiLoader;
}

export async function generateGoogleNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...bytes));
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { nonce, hashedNonce };
}

export function renderGoogleButton(
  parent: HTMLElement,
  config: GoogleIdConfig,
  button: GoogleButtonConfig,
) {
  const api = window.google?.accounts?.id;
  if (!api) throw new Error("Google sign-in is not available.");
  parent.replaceChildren();
  api.initialize(config);
  api.renderButton(parent, button);
}
