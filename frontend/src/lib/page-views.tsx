import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/** Sends a page view on every React Router change so /feed is counted separately from /. */
export function PageViews() {
  const location = useLocation();

  useEffect(() => {
    const page_path = `${location.pathname}${location.search}`;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return null;
}
