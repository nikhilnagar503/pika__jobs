import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { App } from "@/App";
import { AuthProvider } from "@/lib/auth";
import { PageViews } from "@/lib/page-views";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PageViews />
        <App />
        <Analytics />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
