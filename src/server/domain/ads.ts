export type FeedItem<T> = { type: "job"; job: T } | { type: "sponsored"; campaignId: string; label: "Sponsored" };

export function insertSponsorSlots<T>(
  jobs: T[],
  startOrganicIndex: number,
  every: number,
  campaignId: string | null,
): FeedItem<T>[] {
  const items: FeedItem<T>[] = [];
  jobs.forEach((job, index) => {
    items.push({ type: "job", job });
    const organicNumber = startOrganicIndex + index + 1;
    if (campaignId && every > 0 && organicNumber % every === 0) {
      items.push({ type: "sponsored", campaignId, label: "Sponsored" });
    }
  });
  return items;
}
