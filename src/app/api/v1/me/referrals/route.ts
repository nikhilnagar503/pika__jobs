import { run } from "@/server/api";

export async function GET(request: Request) {
  return run(request, (store, actor) => {
    const dashboard = store.referralDashboard(actor);
    return { ...dashboard, payouts: dashboard.payouts.map(({ beneficiaryMasked, ...rest }) => ({ ...rest, beneficiaryMasked })) };
  });
}
