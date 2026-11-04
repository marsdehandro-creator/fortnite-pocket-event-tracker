/**
 * Tournament sync CLI. Run with vite-node (see package.json scripts):
 *
 *   npm run sync:tournaments -- --check-due              → prints DUE / NOT_DUE (exit 0 / 10)
 *   npm run sync:tournaments -- --input capture.json     → merges a capture, writes data + log
 *   npm run sync:tournaments -- --record-failure "why"   → logs a failed attempt (data untouched)
 *   npm run sync:tournaments -- --groups-needed --input capture.txt
 *                                     → lists tournaments still needing an event-page visit (no details stored yet)
 *
 * A capture file is either a JSON RawSyncInput, or one line per page: "GZB64:<base64 gzip JSON>" from
 * scripts/browser/extract-schedule.js (one per region), or a JSON object from extract-event.js (one per tournament).
 *
 * Data files (served as static JSON and fetched by the site at runtime):
 *   public/data/tournaments.json          current + recent events
 *   public/data/tournaments-archive.json  older events — history is never deleted
 *   public/data/sync-log.json             every run: time, counts, errors
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { CompetitiveEvent, SyncLog, SyncRun } from "../src/types/events";
import { normalizeEpicWindow, toSastIso, type RawEpicGroup, type RawRegionCapture, type RawSyncInput } from "../src/ingest/epic";
import { mergeTournaments } from "../src/ingest/merge";
import { appendRun, emptyCounts, isSyncDue } from "../src/ingest/syncLog";
import { isCompetitiveEvent, isSyncLog, sanitizeList } from "../src/utils/validate";

// npm scripts always run from the repo root
const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const FILES = {
  current: path.join(DATA, "tournaments.json"),
  archive: path.join(DATA, "tournaments-archive.json"),
  log: path.join(DATA, "sync-log.json"),
};

const sastNow = (d = new Date()) => toSastIso(d.toISOString())!;

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** Write via a temp file + rename so a crash can never leave a half-written data file. */
function writeJson(file: string, value: unknown) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, file);
}

function loadEvents(file: string): CompetitiveEvent[] {
  const env = readJson<{ items?: unknown }>(file, { items: [] });
  return sanitizeList(env.items, isCompetitiveEvent, path.basename(file));
}

function loadLog(): SyncLog {
  const log = readJson<unknown>(FILES.log, { runs: [] });
  if (!isSyncLog(log)) throw new Error("sync-log.json is malformed — fix or delete it before syncing");
  return log;
}

function saveRun(run: SyncRun) {
  writeJson(FILES.log, appendRun(loadLog(), run));
  const c = run;
  console.log(
    `[sync] ${run.status.toUpperCase()} ${run.startedAt} → ${run.finishedAt} | source: ${run.source} | regions: ${run.regions.join(", ") || "none"}`,
  );
  console.log(
    `[sync] discovered ${c.discovered} · added ${c.added} · updated ${c.updated} · unchanged ${c.unchanged} · rescheduled ${c.rescheduled} · cancelled ${c.cancelled} · restored ${c.restored} · rejected ${c.rejected} · archived ${c.archived}`,
  );
  run.warnings.slice(0, 20).forEach((w) => console.log(`[sync] warning: ${w}`));
  run.errors.forEach((e) => console.error(`[sync] error: ${e}`));
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Reads a capture: either one JSON RawSyncInput document, or one line per page — "GZB64:<base64 gzip JSON>"
 * from extract-schedule.js, or a plain JSON object from extract-event.js.
 */
export function readCapture(file: string): RawSyncInput {
  const text = readFileSync(file, "utf8").trim();
  try {
    const whole = JSON.parse(text) as RawSyncInput;
    if (whole && typeof whole === "object" && "regions" in whole) return whole;
  } catch {
    // not a single JSON document — read it line by line
  }
  const regions: Record<string, RawRegionCapture> = {};
  const groups: Record<string, RawEpicGroup> = {};
  for (const [n, line] of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).entries()) {
    let blob: Record<string, unknown>;
    if (line.startsWith("GZB64:")) blob = JSON.parse(gunzipSync(Buffer.from(line.slice(6), "base64")).toString("utf8"));
    else if (line.startsWith("{")) blob = JSON.parse(line);
    else throw new Error(`capture line ${n + 1}: expected a GZB64: line or a JSON object`);
    if (blob.kind === "schedule") {
      const region = String(blob.region ?? `UNKNOWN_${n + 1}`);
      regions[region] = { ok: !!blob.ok, error: blob.error as string | undefined, windows: (blob.windows as RawRegionCapture["windows"]) ?? [] };
    } else if (blob.kind === "event" && blob.ok && typeof blob.groupId === "string") {
      groups[blob.groupId] = blob as unknown as RawEpicGroup;
    } else if (blob.kind === "event") {
      console.log(`[sync] warning: event page capture failed — ${String(blob.error)}`);
    }
  }
  return { capturedAt: new Date().toISOString(), source: "epic-schedule (browser)", regions, groups };
}

/** Tournament groups in a capture that have no event-page details yet (neither captured nor stored). */
function groupsNeeded(file: string) {
  const input = readCapture(file);
  const stored = new Set(loadEvents(FILES.current).filter((e) => e.groupId && e.description).map((e) => e.groupId));
  const seen = new Map<string, { windowId: string; region: string }>();
  for (const [region, cap] of Object.entries(input.regions)) {
    for (const w of cap.windows) if (!seen.has(w.groupId)) seen.set(w.groupId, { windowId: w.windowId, region });
  }
  const needed = [...seen].filter(([g]) => !input.groups[g] && !stored.has(g));
  for (const [g, { windowId, region }] of needed) {
    console.log(`https://www.fortnite.com/competitive/events/${encodeURIComponent(g)}?round=${encodeURIComponent(windowId)}&region=${region}&lang=en-US`);
  }
  console.error(`${needed.length} of ${seen.size} tournaments need an event-page visit`);
  process.exit(0);
}

function checkDue() {
  const result = isSyncDue(loadLog(), new Date());
  console.log(`${result.due ? "DUE" : "NOT_DUE"} — ${result.reason}`);
  process.exit(result.due ? 0 : 10);
}

function recordFailure(reason: string, source: string) {
  const at = sastNow();
  saveRun({ startedAt: at, finishedAt: at, status: "failed", source, regions: [], ...emptyCounts(), errors: [reason], warnings: [] });
  process.exit(1);
}

function sync(inputFile: string) {
  const startedAt = sastNow();
  const errors: string[] = [];
  const warnings: string[] = [];
  let source = "unknown";
  try {
    const input = readCapture(inputFile);
    source = input.source || source;
    if (!input.regions || typeof input.regions !== "object") throw new Error("capture has no regions");

    const incoming: CompetitiveEvent[] = [];
    let rejected = 0;
    const coveredRegions: string[] = [];
    for (const [region, capture] of Object.entries(input.regions)) {
      if (!capture.ok) {
        errors.push(`${region}: capture failed — ${capture.error ?? "unknown error"}`);
        continue;
      }
      if (!capture.windows.length) {
        // An empty successful capture is suspicious; don't let it cancel everything in that region.
        warnings.push(`${region}: capture returned no events — skipped cancellation checks for this region`);
      } else {
        coveredRegions.push(region);
      }
      for (const w of capture.windows) {
        const r = normalizeEpicWindow({ ...w, region: w.region || region }, input.groups?.[w.groupId]);
        if (r.ok) incoming.push(r.event);
        else {
          rejected++;
          warnings.push(`rejected ${r.error}`);
        }
      }
      if (capture.windows.some((w) => !input.groups?.[w.groupId])) {
        const missing = [...new Set(capture.windows.filter((w) => !input.groups?.[w.groupId]).map((w) => w.groupId))];
        warnings.push(`${region}: no event-page details for ${missing.join(", ")} (shown without description)`);
      }
    }
    if (!incoming.length && !coveredRegions.length) throw new Error(errors.join("; ") || "capture contained no usable events");

    const result = mergeTournaments({
      current: loadEvents(FILES.current),
      archive: loadEvents(FILES.archive),
      incoming,
      coveredRegions,
      now: new Date(),
    });
    const updatedAt = sastNow();
    writeJson(FILES.current, { updatedAt, items: result.current });
    writeJson(FILES.archive, { updatedAt, items: result.archive });

    const status: SyncRun["status"] = errors.length ? "partial" : "success";
    saveRun({
      startedAt,
      finishedAt: sastNow(),
      status,
      source,
      regions: Object.keys(input.regions),
      ...result.counts,
      rejected,
      errors,
      warnings: [...warnings, ...result.warnings],
    });
    process.exit(status === "success" ? 0 : 2);
  } catch (e) {
    // Data files are untouched on failure; only the log records what went wrong.
    saveRun({
      startedAt,
      finishedAt: sastNow(),
      status: "failed",
      source,
      regions: [],
      ...emptyCounts(),
      errors: [...errors, e instanceof Error ? e.message : String(e)],
      warnings,
    });
    process.exit(1);
  }
}

if (process.argv.includes("--check-due")) checkDue();
else if (process.argv.includes("--groups-needed") && arg("--input")) groupsNeeded(arg("--input")!);
else if (process.argv.includes("--record-failure")) recordFailure(arg("--record-failure") ?? "unspecified failure", arg("--source") ?? "scheduler");
else if (arg("--input")) sync(arg("--input")!);
else {
  console.error("usage: sync-tournaments (--check-due | --input <capture.json> | --record-failure <reason>)");
  process.exit(64);
}
