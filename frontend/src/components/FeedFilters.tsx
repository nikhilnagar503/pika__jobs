import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CTC_OPTIONS,
  DURATION_OPTIONS,
  LOCATION_CHIPS,
  STIPEND_OPTIONS,
  WORK_MODE_CHIPS,
  activeFilterCount,
  readFeedQuery,
  toFeedSearchParams,
  type FeedQuery,
} from "@/lib/feed-query";

function Chip({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`filter-chip${selected ? " is-on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function FeedFilters({ onApply }: { onApply?: () => void }) {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => readFeedQuery(params), [params]);
  const [locationDraft, setLocationDraft] = useState(query.location);
  const count = activeFilterCount(query);

  function commit(patch: Partial<FeedQuery>) {
    const next = { ...query, ...patch };
    if (patch.kind != null && patch.kind !== query.kind) {
      next.payMin = "";
      next.payPeriod = "";
      next.duration = "";
    }
    setParams(toFeedSearchParams(next), { replace: true });
    onApply?.();
  }

  function toggleMode(slug: string) {
    const mode = query.mode.includes(slug)
      ? query.mode.filter((item) => item !== slug)
      : [...query.mode, slug];
    commit({ mode });
  }

  function applyLocation(value: string) {
    const location = value.trim();
    setLocationDraft(location);
    commit({ location });
  }

  return (
    <div className="feed-filters">
      <div className="feed-filters-head">
        <h2>Filters{count ? ` · ${count}` : ""}</h2>
        {count > 0 && (
          <button type="button" className="feed-filters-reset" onClick={() => {
            setLocationDraft("");
            commit({
              kind: "",
              location: "",
              mode: [],
              payMin: "",
              payPeriod: "",
              duration: "",
            });
          }}>
            Reset
          </button>
        )}
      </div>

      <section className="filter-group">
        <h3>Type</h3>
        <div className="filter-chips">
          <Chip selected={!query.kind} onClick={() => commit({ kind: "" })}>All</Chip>
          <Chip selected={query.kind === "job"} onClick={() => commit({ kind: "job" })}>Job</Chip>
          <Chip selected={query.kind === "internship"} onClick={() => commit({ kind: "internship" })}>
            Internship
          </Chip>
        </div>
      </section>

      <section className="filter-group">
        <h3>Work mode</h3>
        <div className="filter-chips">
          {WORK_MODE_CHIPS.map((item) => (
            <Chip
              key={item.slug}
              selected={query.mode.includes(item.slug)}
              onClick={() => toggleMode(item.slug)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="filter-group">
        <h3>Location</h3>
        <form
          className="filter-location"
          onSubmit={(event) => {
            event.preventDefault();
            applyLocation(locationDraft);
          }}
        >
          <input
            value={locationDraft}
            onChange={(event) => setLocationDraft(event.target.value)}
            onBlur={() => {
              if (locationDraft.trim() !== query.location) applyLocation(locationDraft);
            }}
            placeholder="City or remote"
            aria-label="Location"
          />
        </form>
        <div className="filter-chips">
          {LOCATION_CHIPS.map((city) => (
            <Chip
              key={city}
              selected={query.location.toLowerCase() === city.toLowerCase()}
              onClick={() => applyLocation(query.location.toLowerCase() === city.toLowerCase() ? "" : city)}
            >
              {city}
            </Chip>
          ))}
        </div>
      </section>

      {query.kind === "internship" && (
        <>
          <section className="filter-group">
            <h3>Stipend</h3>
            <div className="filter-chips">
              {STIPEND_OPTIONS.map((item) => (
                <Chip
                  key={item.label}
                  selected={query.payMin === item.value}
                  onClick={() => commit({ payMin: item.value, payPeriod: item.value ? "monthly" : "" })}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </section>
          <section className="filter-group">
            <h3>Duration</h3>
            <div className="filter-chips">
              {DURATION_OPTIONS.map((item) => (
                <Chip
                  key={item.label}
                  selected={query.duration === item.value}
                  onClick={() => commit({ duration: item.value })}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </section>
        </>
      )}

      {query.kind === "job" && (
        <section className="filter-group">
          <h3>CTC</h3>
          <div className="filter-chips">
            {CTC_OPTIONS.map((item) => (
              <Chip
                key={item.label}
                selected={query.payMin === item.value}
                onClick={() => commit({ payMin: item.value, payPeriod: item.value ? "annual" : "" })}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function FeedFilterToggle() {
  const [params] = useSearchParams();
  const count = activeFilterCount(readFeedQuery(params));
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-ghost feed-filter-toggle"
        onClick={() => setOpen(true)}
      >
        Filters{count ? ` · ${count}` : ""}
      </button>
      {open && (
        <div className="filter-sheet" role="dialog" aria-label="Filters">
          <div className="filter-sheet-head">
            <h2>Filters</h2>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
          <FeedFilters onApply={() => undefined} />
        </div>
      )}
    </>
  );
}
