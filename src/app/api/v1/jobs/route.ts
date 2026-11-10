import { emptyFilters } from "@/server/domain/jobs/feed";
import { run } from "@/server/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return run(request, (store, actor) => {
    const filters = { ...emptyFilters() };
    const kind = url.searchParams.get("kind");
    if (kind) filters.kinds = kind.split(",");
    const q = url.searchParams.get("q");
    if (q) filters.q = q;
    if (url.searchParams.get("unknown") === "0") filters.includeUnknownPay = false;
    return store.listFeed(actor, {
      filters,
      sort: url.searchParams.get("sort") === "latest" ? "latest" : "for_you",
      cursor: url.searchParams.get("cursor"),
      preview: url.searchParams.get("preview") === "pro" ? "pro" : url.searchParams.get("preview") === "free" ? "free" : null,
    });
  });
}
