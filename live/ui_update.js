// live/ui_update.js — the update's window over the menu, and the release notes it shows (logic of the updater, not layout).
// One of the UI layout files (ARCHITECTURE.md §4.7): it registers its screens with UI.add; ui_kit.js holds the registry and the shared helpers.
(function (root) {
  const D = root.DATA || (root.DATA = {}), { UI } = D;
  const { wrapLine } = UI.kit;
  // a release's short «Что нового» from its notes on GitHub, which are the CHANGELOG entry: the first section's points (the menu's
  // «Самое главное» where the entry has it), markup dropped, a point's wrapped lines joined
  const relNotes = (body, n = 5) => { const out = []; let cur = -1, secs = 0;
    for (const l of String(body || '').replace(/\r/g, '').split('\n')) {
      if (/^#{2,4} /.test(l)) { if (secs++ && out.length) break; cur = -1; continue; }
      if (/^[-*] /.test(l)) { if (out.length >= n) break; cur = out.push(l.slice(2).trim()) - 1; continue; }
      if (/^\s+\S/.test(l) && cur >= 0) { out[cur] += ' ' + l.trim(); continue; }
      if (l.trim()) cur = -1; }
    return out.map((s) => s.replace(/\*\*|`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')); };
  const verNewer = (a, b) => { const p = (v) => String(v || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0); const A = p(a), B = p(b);
    for (let i = 0; i < 3; i++) if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); return false; };
  // the releases from GitHub's list that lie after the installed version and up to the found one, the newest first, each with its
  // notes (TASKS 2089); a release with no points is left out
  const relLog = (list, from, to) => (Array.isArray(list) ? list : []).map((r) => ({ v: String((r && r.tag_name) || '').replace(/^v/, ''), items: relNotes(r && r.body) }))
    .filter((r) => r.v && r.items.length && verNewer(r.v, from) && !verNewer(r.v, to)).sort((a, b) => (verNewer(a.v, b.v) ? -1 : verNewer(b.v, a.v) ? 1 : 0));
  // the notes' room under «Что нового:», in rows of 30 px: one release shows up to five points on two lines each, as before; several
  // show their versions with a point or three each, and what does not fit is counted (TASKS 2089)
  const NOTE_ROWS = 9, NOTE_RELS = 3, NOTE_PTS = 3;
  UI.add('update', {
    // the update's window over the menu (TASKS 1870): its lines by the state, the download's bar, one or two buttons under them
    upd: (u) => { const st = !u || u.st === 'idle' ? 'check' : u.st, v = (u && u.v) || '', A = { w: 760 }, rows = [], LW = 46, NW = 56; let y = 146, bar = null, ids;
      const line = (s, k = 'line') => { for (const q of wrapLine(s, k === 'line' ? LW : NW)) { rows.push({ s: q, k, y }); y += k === 'line' ? 36 : 30; } };
      // the cut ends on a whole word and «…» is counted in the line's width, so the page never has to clip it mid-word
      const ellip = (s, n) => { const t = s.split(' '); while (t.length > 1 && t.join(' ').length + 1 > n) t.pop(); return t.join(' ').replace(/[,;:.\s-]+$/, '') + '…'; };
      const cut = (n, w) => { const q = wrapLine(n, w); return q.length > 1 ? [ellip(n, w)] : q; };
      const note = (s, first, k = 'note') => { rows.push({ s, k, first, y }); y += 30; };
      const notes = () => { const R = u.notes || []; if (!R.length) return; y += 8; line(TXT('hud.upd.news'), 'head');
        if (R.length === 1) { for (const n of R[0].items.slice(0, 5)) { const w = wrapLine(n, NW - 8); (w.length > 2 ? [w[0], ellip(w[1], NW - 8)] : w).forEach((q, i) => note(q, !i)); } return; }
        const S = R.slice(0, NOTE_RELS), more = R.length - S.length, per = Math.max(1, Math.min(NOTE_PTS, Math.floor((NOTE_ROWS - S.length - (more ? 1 : 0)) / S.length)));
        for (const r of S) { note(TXT('hud.upd.ver', { v: r.v }), false, 'ver'); for (const n of r.items.slice(0, per)) for (const q of cut(n, NW - 8)) note(q, true); }
        if (more) note(TXT('hud.upd.more', { n: more }), false, 'more'); };
      if (st === 'check') { line(TXT('hud.upd.check')); ids = ['close']; }
      else if (st === 'none') { line(TXT('hud.upd.none', { v })); ids = ['close']; }
      else if (st === 'avail') { line(TXT('hud.upd.avail', { v })); notes(); ids = ['get', 'later']; }
      else if (st === 'web') { line(TXT('hud.upd.avail', { v })); notes(); y += 16; line(TXT('hud.upd.web.2')); ids = ['open', 'close']; }
      else if (st === 'down') { line(TXT('hud.upd.down', { v })); bar = { y: y + 4, h: 24, pct: Math.max(0, Math.min(100, u.pct || 0)) }; y += 60; line(TXT('hud.upd.down.2'), 'dim'); ids = ['hide']; }
      else if (st === 'ready') { line(TXT('hud.upd.ready', { v })); line(TXT('hud.upd.ready.2'), 'dim'); ids = ['run', 'later']; }
      else { line(u.err === 'down' ? TXT('hud.upd.err.down') : TXT('hud.upd.err')); line(u.err === 'net' ? TXT('hud.upd.err.net') : u.err === 'down' ? TXT('hud.upd.err.cut') : TXT('hud.upd.err.other'), 'dim'); ids = ['retry', 'close']; }
      A.h = y + 24 + 64 + 44; A.x = 960 - A.w / 2; A.y = Math.max(316, Math.round((540 - A.h / 2) / 2) * 2);
      const BW = 330, gap = 30, x0 = 960 - (ids.length * BW + (ids.length - 1) * gap) / 2;
      const LABEL = { get: () => TXT('UI.upd.get'), later: () => TXT('UI.upd.later'), hide: () => TXT('UI.upd.hide'), run: () => TXT('UI.upd.run'), retry: () => TXT('UI.upd.retry'), close: () => TXT('UI.upd.close'), open: () => TXT('UI.upd.open') };
      return { A, st, rows: rows.map((r) => Object.assign(r, { y: A.y + r.y })), bar: bar && Object.assign(bar, { x: A.x + 110, w: A.w - 260, y: A.y + bar.y }),
        r: ids.map((id, i) => ({ id, label: LABEL[id](), on: true, size: 24, x: x0 + i * (BW + gap), y: A.y + A.h - 108, w: BW, h: 64 })) }; },
  });
  UI.share('update', { relNotes, relLog, verNewer });
})(typeof window !== 'undefined' ? window : globalThis);
