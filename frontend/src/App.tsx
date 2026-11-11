import { Navigate, Route, Routes } from "react-router-dom";
import { MemberShell, PublicShell } from "@/components/Shell";
import { AccountPage } from "@/pages/AccountPage";
import { AdminEditJobPage } from "@/pages/admin/EditJobPage";
import { AdminFeedPage } from "@/pages/admin/FeedPage";
import { AdminImportJobsPage } from "@/pages/admin/ImportJobsPage";
import { AdminJobsPage } from "@/pages/admin/JobsPage";
import { AdminLayout } from "@/pages/admin/Layout";
import { AdminNewJobPage } from "@/pages/admin/NewJobPage";
import { AdminOverviewPage } from "@/pages/admin/OverviewPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";
import { FeedPage } from "@/pages/FeedPage";
import { HomePage } from "@/pages/HomePage";
import { ActivityPage, PricingPage, SavedPage } from "@/pages/SavedActivityPages";

export function App() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/auth/sign-in" element={<SignInPage />} />
        <Route path="/auth/sign-up" element={<SignUpPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Route>

      <Route element={<MemberShell />}>
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="feed" element={<AdminFeedPage />} />
        <Route path="jobs" element={<AdminJobsPage />} />
        <Route path="jobs/new" element={<AdminNewJobPage />} />
        <Route path="jobs/import" element={<AdminImportJobsPage />} />
        <Route path="jobs/:id/edit" element={<AdminEditJobPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
