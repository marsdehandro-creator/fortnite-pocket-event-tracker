// Run in a real browser tab on https://www.fortnite.com/competitive/schedule?region=<REGION>&lang=en-US
// (e.g. via the browser tool's JavaScript runner, which awaits the returned promise).
// Reads the structured schedule data the page already loaded — no extra requests — and returns ONE line:
//   GZB64:<base64 of gzip of JSON {kind:"schedule", region, ok, windows:[...]}>
// Append each line to the capture file; scripts/sync-tournaments.ts decodes it.
// Every event window Epic lists is returned, whatever its type: classification happens later, in code.
(async () => {
  const SINCE_DAYS = 10; // also return recently finished windows so completions and late changes are recorded
  const ALL_PLATFORMS = 5;
  let result;
  try {
    const ctx = window.__reactRouterContext;
    const data = ctx && ctx.state && ctx.state.loaderData && ctx.state.loaderData["routes/competitive.schedule"];
    if (!data || !Array.isArray(data.scheduleDays)) {
      result = { kind: "schedule", region: null, ok: false, error: "schedule data not found on this page", windows: [] };
    } else {
      const region = String(data.activeRegion || new URL(location.href).searchParams.get("region") || "").toUpperCase();
      const since = Date.now() - SINCE_DAYS * 86400000;
      const windows = [];
      const seen = new Set();
      for (const day of data.scheduleDays) {
        for (const e of day.events || []) {
          const w = e.eventWindow || {};
          const id = w.eventWindowId || e.eventWindowId;
          if (!id || seen.has(id)) continue;
          if (Date.parse(w.endTime || "") < since) continue;
          seen.add(id);
          // keep only the requirement tokens the importer understands (shrinks the payload a lot)
          const req = (Array.isArray(w.additionalRequirements) ? w.additionalRequirements : [])
            .flat()
            .map((t) => (t === "mfa" ? "mfa" : String(t).startsWith("eula:") ? "eula:" : String(t).startsWith("currentRanking:") ? "currentRanking:" : null))
            .filter(Boolean);
          windows.push({
            windowId: id,
            groupId: (e.eventGroup && e.eventGroup.id) || "",
            tournamentName: e.tournamentName || "",
            roundName: e.roundName || undefined,
            state: e.eventState || undefined,
            beginTime: w.beginTime,
            endTime: w.endTime,
            isTBD: w.isTBD || undefined,
            requirements: req.length ? [...new Set(req)] : undefined,
            roundType: (w.metadata && w.metadata.RoundType) || undefined,
            platforms: Array.isArray(e.platforms) && e.platforms.length && e.platforms.length < ALL_PLATFORMS ? e.platforms : undefined,
            region,
          });
        }
      }
      result = { kind: "schedule", region, ok: true, availableRegions: data.availableRegions || [], windows };
    }
  } catch (err) {
    result = { kind: "schedule", region: null, ok: false, error: String((err && err.message) || err), windows: [] };
  }
  const gz = new Blob([JSON.stringify(result)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(gz).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `GZB64:${btoa(bin)}`;
})();
