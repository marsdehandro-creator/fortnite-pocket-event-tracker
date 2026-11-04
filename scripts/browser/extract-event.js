// Run in a real browser tab on an event page, e.g.
// https://www.fortnite.com/competitive/events/S43_TriosCashCup?round=S43_TriosCashCup_Event1_EU&region=EU&lang=en-US
// Returns ONE line of JSON — {"kind":"event","ok":true,"groupId":...,...} — with tournament-level details for that
// event group (one page per group is enough). Append it to the capture file as its own line.
(() => {
  let result;
  try {
    const ld = window.__reactRouterContext && window.__reactRouterContext.state && window.__reactRouterContext.state.loaderData;
    const v = ld && ld["routes/competitive.events.$event._index"];
    if (!v || !v.eventGroup) {
      result = { kind: "event", ok: false, error: "event data not found on this page" };
    } else {
      const ev = v.selectedEvent || {};
      const meta = ev.metadata || {};
      const content = ev.content || {};
      const info = v.eventInfoData || {};
      result = {
        kind: "event",
        ok: true,
        groupId: v.eventGroup.id,
        eventName: info.eventName || content.title_line_1 || content.long_format_title || undefined,
        mode: content.title_line_2 || undefined,
        tournamentType: meta.tournamentType || undefined,
        description: content.details_description || undefined,
        minimumAccountLevel: typeof meta.minimumAccountLevel === "number" ? meta.minimumAccountLevel : undefined,
        playlistId: info.playlistId || undefined,
        systemFeatures: Array.isArray(meta.requireSystemFeatures) ? meta.requireSystemFeatures : undefined,
        rulesHref: v.rulesArticleHref || undefined,
        image: content.playlist_tile_image || info.thumbnailUrl || undefined,
        isLan: info.isLan || undefined,
      };
    }
  } catch (err) {
    result = { kind: "event", ok: false, error: String((err && err.message) || err) };
  }
  return JSON.stringify(result);
})();
