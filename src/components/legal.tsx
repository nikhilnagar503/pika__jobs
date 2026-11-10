import { SiteFooter, SiteHeader } from "@/components/site-header";

const pages: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms",
    body: [
      "This is a draft for review, not an approved customer contract.",
      "Pikajobs helps adults aged 18 and over discover jobs and internships. It does not employ you, submit applications, or promise hiring.",
      "Live listings are available after signup. Pro is a separate curated collection sold as a one-time 30 day pass when payments are enabled.",
    ],
  },
  privacy: {
    title: "Privacy",
    body: [
      "This is a draft for review, not a final privacy notice.",
      "The product collects an email, optional preferences, saves, and application events you create. It does not ask for a resume, Aadhaar, bank details, GPS, or a photograph during onboarding.",
      "Bank or UPI details are collected only when you request a referral payout, and referral partners do not receive the referred person's contact details.",
    ],
  },
  refunds: {
    title: "Refund policy",
    body: [
      "This is a proposed policy and needs business and legal review before any payment is collected.",
      "The proposed window is 7 days to request a refund, reviewed by support. A request is not itself an approved refund.",
      "A confirmed full refund revokes the related pass and reverses related referral commission. A partial refund follows the product amount actually refunded.",
    ],
  },
  "referral-terms": {
    title: "Referral terms",
    body: [
      "This draft matches the current implementation and is not tax advice.",
      "A verified member who accepts these terms receives a random code. The first valid code captured for a new account within 30 days is kept. Later codes do not replace it. Self-referral is rejected. An existing account cannot add a referrer.",
      "Commission is 10% of eligible captured product revenue after discounts, excluding separately stated tax. Gateway fees are not deducted from that base. Credit stays pending for 30 days. The minimum payout request is INR 500. Payouts are manual, in INR, and are not instant.",
    ],
  },
  contact: {
    title: "Contact",
    body: [
      "Business identification, a public support address, and legal entity details will be published before payments open.",
      "Until then this page is a placeholder. Do not send bank documents or identity documents to a sourcing agent.",
      "To report a listing, sign in and use Report on the job. That report is not sent to the employer.",
    ],
  },
};

export function legalMetadata(slug: string) {
  return { title: pages[slug]?.title ?? "Pikajobs" };
}

export function Legal({ slug }: { slug: keyof typeof pages }) {
  const page = pages[slug];
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap section">
        <p className="flag">Draft · awaiting business approval</p>
        <h1>{page.title}</h1>
        {page.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </main>
      <SiteFooter />
    </>
  );
}
