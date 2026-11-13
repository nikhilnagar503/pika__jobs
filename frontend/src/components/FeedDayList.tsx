import { JobCard, type JobCardData } from "@/components/JobCard";
import { groupByFeedDay, listingPostedAt } from "@/lib/time";

type FeedDayListProps = {
  jobs: JobCardData[];
  mode?: "member" | "admin";
  onDeleted?: (jobId: string) => void;
  onPublished?: (jobId: string) => void;
};

export function FeedDayList({ jobs, mode = "member", onDeleted, onPublished }: FeedDayListProps) {
  const groups = groupByFeedDay(jobs, listingPostedAt);

  return (
    <div className="feed">
      {groups.map((group) => (
        <section key={group.key} className="feed-day-group" aria-label={group.label}>
          <h2 className="feed-day">{group.label}</h2>
          {group.items.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              mode={mode}
              onDeleted={onDeleted}
              onPublished={onPublished}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
