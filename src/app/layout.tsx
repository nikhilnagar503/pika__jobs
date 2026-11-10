import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pikajobs", template: "%s · Pikajobs" },
  description: "Explore curated jobs and internships in a simple feed.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <div className="banner">
          Supabase project is linked. Job data still uses the local file store until the Postgres adapter is switched on. Payments stay closed until Razorpay and the business details are ready.
        </div>
        {children}
      </body>
    </html>
  );
}
