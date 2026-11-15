// live/ui_hero.js — the hero screen, the ability cards, the meta upgrades, the discoveries, the fork and the codex, in view px.
// One of the UI layout files (ARCHITECTURE.md §4.7): it registers its screens with UI.add; ui_kit.js holds the registry and the shared helpers.
(function (root) {
  const D = root.DATA || (root.DATA = {}), { UI } = D;
  const { ABILITIES, STATS } = D;
  const { CELL, STEP, COLS, sortCol, bagGrid, tabRow, INV } = UI.kit;
  UI.add('hero', {
    // the discoveries tab (TASKS 394): two columns of rows under the same tab button
    unlocks: () => D.UNLOCKS.map((U, i) => ({ id: 'un:' + i, un: i, on: true, x: 200 + (i % 2) * 770, y: 276 + Math.floor(i / 2) * 76, w: 750, h: 72 })),
    meta: (cls, tab) => { const back = { id: 'back', label: TXT('UI.meta.back.label'), on: true, x: 810, y: 890, w: 300, h: 70 }, cx = { id: 'codex', label: TXT('UI.codex.open'), on: true, x: 180, y: 120, w: 260, h: 60 }, tb = [['up', TXT('UI.meta.tab.up')], ['open', TXT('UI.meta.tab.open')]].map(([t, label], i) => ({ id: 'tab:' + t, tab: t, label, on: true, x: 1300 + i * 222, y: 124, w: 212, h: 56 })); if (tab === 'open') return UI.unlocks().concat([back, ...tb, cx]); const list = D.metaFor(cls), rows = Math.ceil(list.length / 2), step = Math.min(112, Math.floor(572 / rows));
      return list.map((m, i) => ({ id: m.id, x: 180 + Math.floor(i / rows) * 800, y: 276 + (i % rows) * step, w: 760, h: step - 4 })).concat([back, ...tb, cx]); },
    fork: () => [0, 1].map((i) => ({ id: 'fork:' + i, i, on: true, x: 460 + i * 520, y: 340, w: 480, h: 390 })),
    // the codex (TASKS 395): its pages' entries in three columns, tabs over them, the pager and the way back under them
    codex: (tab, page) => { const list = D.codexList(tab), pages = Math.max(1, Math.ceil(list.length / D.CODEX_PAGE)), p = Math.min(page || 0, pages - 1);
      const pg = list.slice(p * D.CODEX_PAGE, (p + 1) * D.CODEX_PAGE), rows = Math.max(1, Math.ceil(pg.length / 3)), step = Math.min(64, Math.floor(600 / rows));
      // a page's entries spread evenly over its three columns, the rows as tall as the page lets them (TASKS 1764)
      return { list, pages, page: p, r: pg.map((q, i) => ({ id: 'cx:' + q.k, q, x: 120 + Math.floor(i / rows) * 580, y: 274 + (i % rows) * step, w: 560, h: step - 6 }))
        .concat(D.CODEX_TABS.map((t, i) => ({ id: 'tab:' + t, tab: t, label: { m: TXT('UI.codex.m'), it: TXT('UI.codex.it'), p: TXT('UI.codex.p') }[t], on: true, x: 590 + i * 250, y: 190, w: 240, h: 60 })))
        .concat([{ id: 'back', label: TXT('UI.codex.back'), on: true, x: 810, y: 890, w: 300, h: 70 }])
        .concat(pages > 1 ? [{ id: 'prev', label: TXT('UI.codex.prev'), on: p > 0, x: 660, y: 890, w: 130, h: 70 }, { id: 'next', label: TXT('UI.codex.next'), on: p < pages - 1, x: 1130, y: 890, w: 130, h: 70 }] : []) }; },
    // the hero screen (TASKS 1332), look B as on ref_ui_inv_b: the gear round the portrait and the stats on a leather panel on the
    // left, the bag and the skills on a parchment sheet on the right
    inv: (abs = ABILITIES, len, tab) => {
      const { L: Lp, R: Rp } = INV, r = [], lx = Lp.x + 50, rx = Lp.x + Lp.w - 50 - CELL;
      const eq = [['helm', lx, 0], ['armor', lx, 1], ['gloves', lx, 2], ['boots', lx, 3], ['amulet', rx, 0], ['weapon', rx, 1], ['offhand', rx, 2], ['ring', rx, 3]];
      for (const [s, x, row] of eq) r.push({ id: 'eq:' + s, slot: s, x, y: Lp.y + 108 + row * 86, w: CELL, h: CELL });
      r.push(...bagGrid(Rp.x + 76, Rp.y + 130, 'bag', undefined, len, tab), ...tabRow(Rp.x + 76, Rp.y + 76, len));
      STATS.forEach((s, i) => r.push({ id: 'stat:' + s.k, k: s.k, x: Lp.x + Lp.w - 100, y: Lp.y + 476 + i * 52, w: 44, h: 44 }));
      // a visit's points taken back (TASKS 1857): each button after its points' count, the stats' on their heading's line, as it
      // hung loose between two rows (TASKS 1887 з)
      r.push({ id: 'reset:st', label: TXT('UI.inv.reset'), on: true, x: Lp.x + 330, y: Lp.y + 447, w: 150, h: 36 }, { id: 'reset:ab', label: TXT('UI.inv.reset'), on: true, x: Rp.x + 360, y: Rp.y + 414, w: 190, h: 48 });
      abs.forEach((a, i) => r.push({ id: 'ab:' + a.id, ab: a.id, x: Rp.x + 76 + i * 324, y: Rp.y + 470, w: 300, h: 280 }));
      r.push({ id: 'close', x: Rp.x + Rp.w - 92, y: Rp.y + 34, w: 52, h: 52 }, ...sortCol('sort', Rp.x + 76 + COLS * STEP + 40, Rp.y + 130));
      return { P: { x: Lp.x, y: Lp.y, w: Rp.x + Rp.w - Lp.x, h: Lp.h }, L: Lp, R: Rp, r };
    },
    // an ability card's lines in a card h tall (TASKS 2001): the cost at the foot, the fork line over it, the rank's text in its n
    // wrapped lines (split: its head on a line of its own) raised with its rule before it would reach the fork line, which drops
    // under the text only when the text cannot rise further
    abCard: (h, n, split, fork) => { const LH = 27, cost = h - 34, span = n <= 1 ? 0 : (split ? 30 : LH) + LH * (n - 2);
      const y0 = Math.max(116, Math.min(146, (fork ? h - 66 : cost) - LH - span)), f = fork ? Math.min(cost - 22, Math.max(h - 66, y0 + span + LH)) : null;
      return { rule: y0 - 24, y0, d1: y0 + 30, last: y0 + span, fork: f, cost }; },
  });
})(typeof window !== 'undefined' ? window : globalThis);
