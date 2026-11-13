import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Sends a GA4 page view on every React Router change so /feed is counted separately from /. */
export function PageViews() {
  const location = useLocation();

  useEffect(() => {
    const page_path = `${location.pathname}${location.search}`;
    window.gtag?.("event", "page_view", {
      page_path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return null;
}
