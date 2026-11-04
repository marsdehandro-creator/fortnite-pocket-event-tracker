import { useEffect, useMemo, useRef, useState } from "react";
import type { AlertsState } from "../hooks/useAlerts";
import type { CompetitiveEvent, TeamFormat, UpdateEvent } from "../types/events";
import { buildIcs, downloadIcs, eventToIcsEntry, updateToIcsEntry } from "../notifications/ics";
import { alertableEvents, alertableUpdates, nextAlert } from "../notifications/plan";
import { FORMAT_LABEL, FORMATS, LOCAL_REGIONS, regionLabel } from "../utils/labels";
import { formatSASTDateTime } from "../utils/time";
import { availableRegions, TOURNAMENT_CATEGORIES, TOURNAMENT_CATEGORY_LABEL, type TournamentCategory } from "../utils/tournaments";
import { BellIcon, CalendarIcon, CloseIcon } from "./Icons";

interface AlertsDialogProps {
  open: boolean;
  onClose: () => void;
  alerts: AlertsState;
  events: CompetitiveEvent[];
  updates: UpdateEvent[];
  now: number;
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Multi-select chip row reusing the site's segmented-chip styling. "All" clears the selection (= everything). */
function MultiChips<T extends string>(props: {
  label: string;
  options: readonly T[];
  selected: T[];
  onToggle: (option: T) => void;
  onAll?: () => void;
  optionLabel: (o: T) => string;
  allLabel?: string;
}) {
  const { label, options, selected, onToggle, onAll, optionLabel, allLabel } = props;
  return (
    <div className="alerts__field">
      <p className="alerts__label">{label}</p>
      <div className="segmented alerts__chips" role="group" aria-label={label}>
        {allLabel && onAll && (
          <button type="button" className="segmented__option" aria-pressed={selected.length === 0} onClick={onAll}>
            {allLabel}
          </button>
        )}
        {options.map((o) => (
          <button key={o} type="button" className="segmented__option" aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>
            {optionLabel(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="alerts__switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="alerts__switch-track" aria-hidden="true" />
      <span>
        <span className="alerts__switch-label">{label}</span>
        <span className="alerts__hint">{hint}</span>
      </span>
    </label>
  );
}

export function AlertsDialog({ open, onClose, alerts, events, updates, now }: AlertsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { prefs, setPrefs, permission, support, background } = alerts;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setMessage(null);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const regions = useMemo(() => availableRegions(events, LOCAL_REGIONS), [events]);
  // Preview against "on" so the numbers are useful before alerts are switched on.
  const previewPrefs = { ...prefs, enabled: true };
  const matching = alertableEvents(events, previewPrefs, now);
  const matchingUpdates = alertableUpdates(updates, previewPrefs, now);
  const next = nextAlert(events, updates, previewPrefs, now);
  const on = prefs.enabled && permission === "granted";
  const iosNeedsHomeScreen = support.ios && !support.standalone && !support.notifications;

  const turnOn = async () => {
    const result = await alerts.enable();
    if (result === "denied") setMessage("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
    else if (result === "unsupported") setMessage("This browser can't show notifications — use the calendar option below.");
    else if (result === "granted") setMessage("Alerts are on for this device.");
  };

  const test = async () => setMessage((await alerts.sendTest()) ? "Test alert sent — check your notifications." : "Couldn't show a test alert on this device.");

  const exportCalendar = () => {
    const ics = buildIcs([...matching.map(eventToIcsEntry), ...matchingUpdates.map(updateToIcsEntry)], now);
    downloadIcs("fortnite-alerts.ics", ics);
    setMessage(`Calendar file with ${matching.length + matchingUpdates.length} events downloaded — open it to add them with both reminders.`);
  };

  return (
    <dialog ref={dialogRef} className="search-dialog alerts-dialog" aria-labelledby="alerts-title" onClose={onClose} onClick={(e) => e.target === dialogRef.current && onClose()}>
      <div className="search-dialog__box">
        <div className="alerts__head">
          <BellIcon className="alerts__head-icon" />
          <h2 id="alerts-title" className="alerts__title">
            Alerts
          </h2>
          <button type="button" className="icon-button" aria-label="Close alerts" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="alerts__body">
          <section className={`alerts__status${on ? " is-on" : ""}`} aria-live="polite">
            {on ? (
              <>
                <p className="alerts__status-text">
                  <span className="dot dot--green" /> Alerts are on for this device
                </p>
                <div className="alerts__actions">
                  <button type="button" className="outline-button" onClick={test}>
                    Send a test alert
                  </button>
                  <button type="button" className="text-button" onClick={alerts.disable}>
                    Turn off
                  </button>
                </div>
              </>
            ) : iosNeedsHomeScreen ? (
              <p className="alerts__status-text">
                On iPhone and iPad, alerts only work from the Home Screen app: tap <strong>Share → Add to Home Screen</strong>, open the tracker from your
                Home Screen, then turn alerts on here (iOS 16.4 or later). Or use the calendar option below.
              </p>
            ) : permission === "unsupported" ? (
              <p className="alerts__status-text">This browser can't show notifications. Use the calendar option below instead.</p>
            ) : permission === "denied" ? (
              <p className="alerts__status-text">Notifications are blocked for this site. Allow them in your browser's site settings, then reopen this panel.</p>
            ) : (
              <>
                <p className="alerts__status-text">Get a notification 2 days and 2 hours before the tournaments and updates you care about.</p>
                <div className="alerts__actions">
                  <button type="button" className="outline-button" onClick={turnOn}>
                    <BellIcon /> Turn on alerts
                  </button>
                </div>
              </>
            )}
            {message && <p className="alerts__message">{message}</p>}
          </section>

          <section className="alerts__section">
            <Switch
              checked={prefs.tournaments}
              onChange={(v) => setPrefs((p) => ({ ...p, tournaments: v }))}
              label="Tournaments"
              hint="2 days and 2 hours before each matching session"
            />
            <Switch
              checked={prefs.updates}
              onChange={(v) => setPrefs((p) => ({ ...p, updates: v }))}
              label="Scheduled updates & downtime"
              hint="2 days and 2 hours before servers go down"
            />
          </section>

          {prefs.tournaments && (
            <section className="alerts__section">
              <MultiChips<TournamentCategory>
                label="Tournament types"
                options={TOURNAMENT_CATEGORIES}
                selected={prefs.categories}
                onToggle={(c) => setPrefs((p) => ({ ...p, categories: toggle(p.categories, c) }))}
                optionLabel={(c) => TOURNAMENT_CATEGORY_LABEL[c]}
              />
              <MultiChips<string>
                label="Regions"
                options={regions}
                selected={prefs.regions}
                onToggle={(r) => setPrefs((p) => ({ ...p, regions: toggle(p.regions, r) }))}
                onAll={() => setPrefs((p) => ({ ...p, regions: [] }))}
                optionLabel={(r) => regionLabel(r)}
                allLabel="All regions"
              />
              <MultiChips<TeamFormat>
                label="Formats"
                options={FORMATS}
                selected={prefs.formats}
                onToggle={(f) => setPrefs((p) => ({ ...p, formats: toggle(p.formats, f) }))}
                onAll={() => setPrefs((p) => ({ ...p, formats: [] }))}
                optionLabel={(f) => FORMAT_LABEL[f]}
                allLabel="All formats"
              />
              {prefs.categories.length === 0 && <p className="alerts__hint">Pick at least one type to get tournament alerts.</p>}
            </section>
          )}

          <p className="alerts__preview">
            {prefs.tournaments && (
              <>
                <strong>{matching.length}</strong> upcoming tournament session{matching.length === 1 ? "" : "s"} match
                {prefs.updates ? " · " : ". "}
              </>
            )}
            {prefs.updates && (
              <>
                <strong>{matchingUpdates.length}</strong> scheduled update{matchingUpdates.length === 1 ? "" : "s"}.{" "}
              </>
            )}
            {next && (
              <>
                Next alert: {formatSASTDateTime(next.at)} — {next.title} ({next.lead === "2d" ? "2 days before" : "2 hours before"}).
              </>
            )}
          </p>

          <section className="alerts__section alerts__delivery">
            <p className="alerts__label">How alerts reach this device</p>
            <ul>
              <li>
                <strong>While the tracker is open</strong> (even in a background tab): alerts arrive on time.
              </li>
              {support.periodicSync && support.standalone ? (
                <li>
                  <strong>When the app is closed:</strong>{" "}
                  {background
                    ? "background checks are on. Your browser decides how often they run, so an alert can arrive late."
                    : "turn alerts on to enable background checks. Your browser decides how often they run, so an alert can arrive late."}
                </li>
              ) : support.periodicSync ? (
                <li>
                  <strong>When the tracker is closed:</strong> install it as an app (browser menu → <em>Install app</em> / <em>Add to Home screen</em>) so
                  your browser can check in the background. Your browser decides how often, so alerts can arrive late.
                </li>
              ) : (
                <li>
                  <strong>When the tracker is closed:</strong> this browser can't check in the background, so alerts only arrive while it's open.
                </li>
              )}
              <li>
                <strong>Never miss one:</strong> add the matching events to your phone's calendar. The calendar gives the same 2-day and 2-hour
                reminders even with the browser closed. Download again when new events are announced.
              </li>
            </ul>
            <div className="alerts__actions">
              <button type="button" className="outline-button" onClick={exportCalendar} disabled={!matching.length && !matchingUpdates.length}>
                <CalendarIcon /> Add {matching.length + matchingUpdates.length} to calendar
              </button>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}
