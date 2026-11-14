// live/ui_news.js — the «Что нового» screen and the version's sheet on the menu, in view px.
// One of the UI layout files (ARCHITECTURE.md §4.7): it registers its screens with UI.add; ui_kit.js holds the registry and the shared helpers.
(function (root) {
  const D = root.DATA || (root.DATA = {}), { UI } = D;
  const { wrapLine } = UI.kit;
  // «Что нового» (TASKS 1038): DATA.CHANGES, newest first, as rows of fixed heights; a point is wrapped by its length (the sim
  // scrolls by whole rows, so it needs the rows without the HUD's text measure; the screen's qa check catches a line too long)
  const NEWS = { P: { x: 300, y: 60, w: 1320, h: 960 }, top: 150, bottom: 120, wrap: 84, h: { ver: 70, group: 46, line: 34, gap: 8 } };
  // only the versions in `open` show their points (TASKS 1971); with no `open` only the newest one does
  let newsMemo = { src: null, by: {} };
  const newsRows = (open) => { const top = (D.CHANGES[0] || {}).v, on = open || { [top]: 1 }, key = (D.CHANGES || []).filter((e) => on[e.v]).map((e) => e.v).join('|');
    if (newsMemo.src !== D.CHANGES) newsMemo = { src: D.CHANGES, by: {} };
    if (newsMemo.by[key]) return newsMemo.by[key]; const rows = [];
    for (const e of D.CHANGES || []) { rows.push({ k: 'ver', v: e.v, date: e.date, open: !!on[e.v], h: NEWS.h.ver });
      if (!on[e.v]) continue;
      for (const g of e.groups) { rows.push({ k: 'group', s: g.name, h: NEWS.h.group });
        for (const it of g.items) wrapLine(it, NEWS.wrap).forEach((s, i, a) => rows.push({ k: 'line', s, first: !i, h: NEWS.h.line + (i === a.length - 1 ? NEWS.h.gap : 0) })); } }
    return (newsMemo.by[key] = rows); };
  const NEWS_FRAME = { x: 1250, bottom0: 972, w: 640, top: 134, line: 28, gap: 20, bottom: 44, wrap: 42, link: { gap: 14, w: 320, h: 36 } };
  UI.add('news', {
    // the version's sheet on the menu's right (TASKS 1305, 1873): «Версия N» over its main lines, wrapped to the frame, and the
    // small link to the whole «Что нового» under them; it stands on its bottom edge, so a longer list grows up into the empty
    // corner. It carries the version itself, so with no main lines it still stands, the heading and the link alone
    newsFrame: (main = (D.CHANGES[0] || {}).main) => { const top = D.CHANGES[0]; if (!top) return null; const F = NEWS_FRAME, rows = []; let y = F.top;
      (main || []).forEach((s, i) => { if (i) y += F.gap; wrapLine(s, F.wrap).forEach((q, j) => { rows.push({ s: q, first: !j, y }); y += F.line; }); });
      const ly = (rows.length ? y + F.link.gap : y - 20), h = ly + F.link.h + F.bottom - 12, y0 = F.bottom0 - h;
      return { P: { x: F.x, y: y0, w: F.w, h }, v: top.v, rows: rows.map((r) => Object.assign(r, { y: y0 + r.y })),
        link: { x: F.x + (F.w - F.link.w) / 2, y: y0 + ly, w: F.link.w, h: F.link.h }, linkLabel: TXT('UI.menu.news', { v: top.v }) }; },
    // the rows that fit from row `top`, and the last top that still fills the view (the end of the list sits at its bottom)
    news: (top, open) => { const P = NEWS.P, rows = newsRows(open), vh = P.h - NEWS.top - NEWS.bottom; let max = rows.length, fill = 0;
      while (max > 0 && fill + rows[max - 1].h <= vh) fill += rows[--max].h;
      const t = Math.max(0, Math.min(max, top || 0)), shown = []; let y = P.y + NEWS.top;
      for (let i = t; i < rows.length && y + rows[i].h <= P.y + NEWS.top + vh; i++) { shown.push(Object.assign({ y }, rows[i])); y += rows[i].h; }
      const view = { x: P.x + 60, y: P.y + NEWS.top, w: P.w - 120, h: vh }, sx = P.x + P.w - 56;
      // the scroll's track and thumb for both the sim's drag and the HUD (TASKS 1971); the track's hit is wider than its ink rule
      const th = Math.max(60, vh * vh / (vh + max * 34)), bar = max > 0 ? { track: { id: 'track', x: sx - 14, y: view.y, w: 31, h: vh }, thumb: { x: sx - 4, y: view.y + (vh - th) * (t / max), w: 11, h: th }, x: sx } : null;
      return { P, rows: shown, top: t, max, n: rows.length, view, bar,
        heads: shown.filter((r) => r.k === 'ver').map((r) => ({ id: 'ver:' + r.v, v: r.v, x: view.x, y: r.y, w: bar ? bar.track.x - view.x : view.w, h: r.h })),
        r: [{ id: 'back', label: TXT('UI.news.back.label'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 94, w: 300, h: 66 }] }; },
  });
  UI.share('news', { newsRows });
})(typeof window !== 'undefined' ? window : globalThis);
