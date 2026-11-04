import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackerData } from "../types/events";
import { normalizeText } from "../utils/discoveries";
import { DISCOVERY_CATEGORY_LABEL, eventTypeLabel, FORMAT_LABEL, MAP_CHANGE_LABEL, UPDATE_KIND_LABEL } from "../utils/labels";
import { formatSASTShortDate } from "../utils/time";
import { CloseIcon, SearchIcon } from "./Icons";
import type { FocusKind } from "./Panel";

interface Result {
  kind: FocusKind;
  id: string;
  title: string;
  meta: string;
  haystack: string;
}

const GROUP_LABEL: Record<FocusKind, string> = {
  update: "Updates & downtime",
  event: "Competitive events",
  poi: "Landing spots",
  discovery: "Discoveries",
  change: "Map changes",
};
const MAX_PER_GROUP = 5;

function buildIndex(data: TrackerData): Result[] {
  const r: Result[] = [];
  data.updates.forEach((u) =>
    r.push({
      kind: "update",
      id: u.id,
      title: `${u.version ? `v${u.version} · ` : ""}${u.name}`,
      meta: `${UPDATE_KIND_LABEL[u.kind]} · ${formatSASTShortDate(u.downtimeStartsAt)}`,
      haystack: [u.name, u.version ?? "", u.kind, u.notes ?? ""].join(" "),
    }),
  );
  data.events.forEach((e) =>
    r.push({
      kind: "event",
      id: e.id,
      title: `${e.name}${e.round ? ` · ${e.round}` : ""}`,
      meta: [eventTypeLabel(e.type), e.format && FORMAT_LABEL[e.format], e.region, formatSASTShortDate(e.startsAt), e.cancelled ? "cancelled" : ""].filter(Boolean).join(" · "),
      haystack: [e.name, e.round ?? "", e.type, eventTypeLabel(e.type), e.format ?? "", e.region, e.mode, ...(e.tags ?? [])].join(" "),
    }),
  );
  data.pois
    .filter((p) => p.status === "active")
    .forEach((p) => r.push({ kind: "poi", id: p.id, title: p.name, meta: p.mapArea, haystack: [p.name, p.mapArea, p.description, ...(p.highlights ?? [])].join(" ") }));
  data.discoveries.forEach((d) =>
    r.push({
      kind: "discovery",
      id: d.id,
      title: d.title,
      meta: `${DISCOVERY_CATEGORY_LABEL[d.category]} · ${d.mapArea}${d.status === "archived" ? " · archived" : ""}`,
      haystack: [d.title, d.summary, d.details ?? "", d.mapArea, DISCOVERY_CATEGORY_LABEL[d.category]].join(" "),
    }),
  );
  data.mapChanges.forEach((c) =>
    r.push({ kind: "change", id: c.id, title: c.title, meta: `${MAP_CHANGE_LABEL[c.type]} · ${formatSASTShortDate(c.date)}`, haystack: [c.title, c.description].join(" ") }),
  );
  return r.map((x) => ({ ...x, haystack: normalizeText(`${x.title} ${x.haystack}`) }));
}

interface SearchDialogProps {
  open: boolean;
  data: TrackerData;
  onClose: () => void;
  onSelect: (kind: FocusKind, id: string) => void;
}

export function SearchDialog({ open, data, onClose, onSelect }: SearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const index = useMemo(() => buildIndex(data), [data]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  const matches = terms.length ? index.filter((r) => terms.every((t) => r.haystack.includes(t))) : [];
  const groups = (Object.keys(GROUP_LABEL) as FocusKind[])
    .map((kind) => ({ kind, items: matches.filter((m) => m.kind === kind).slice(0, MAX_PER_GROUP) }))
    .filter((g) => g.items.length);

  const choose = (r: Result) => {
    onClose();
    onSelect(r.kind, r.id);
  };

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      aria-label="Search the tracker"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <div className="search-dialog__box">
        <form
          className="search search--dialog"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (groups[0]) choose(groups[0].items[0]);
          }}
        >
          <SearchIcon className="search__icon" />
          <input
            type="search"
            autoFocus
            placeholder="Search updates, cups, POIs, secrets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the tracker"
          />
          <button type="button" className="icon-button" aria-label="Close search" onClick={onClose}>
            <CloseIcon />
          </button>
        </form>
        <div className="search-dialog__results" aria-live="polite">
          {!terms.length && <p className="search-dialog__hint">Try “boss”, “Loguetown”, “FNCS” or “maintenance”. Press / anywhere to search.</p>}
          {terms.length > 0 && !groups.length && <p className="search-dialog__hint">No results for “{query}”.</p>}
          {groups.map((g) => (
            <div key={g.kind} className="search-group">
              <p className="search-group__label">{GROUP_LABEL[g.kind]}</p>
              <ul>
                {g.items.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="search-result" onClick={() => choose(r)}>
                      <span className="search-result__title">{r.title}</span>
                      <span className="search-result__meta">{r.meta}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </dialog>
  );
}
