// live/ui_town.js — the town's windows: workshop, talk, notice board, journal, stash, shop, gate, altar and the dialogs, in view px.
// One of the UI layout files (ARCHITECTURE.md §4.7): it registers its screens with UI.add; ui_kit.js holds the registry and the shared helpers.
(function (root) {
  const D = root.DATA || (root.DATA = {}), { UI } = D;
  const { SHOP, SLOTS, STASH } = D;
  const { CELL, STEP, grid, sortCol, paperClose, bagGrid, tabRow } = UI.kit;
  UI.add('town', {
    // a town workshop (TASKS 1013): the worn gear in a row and the bag under it on the left, the chosen piece, its affixes, the price
    // and the work's button on the right
    craft: (len, tab) => { const P = { x: 190, y: 110, w: 1540, h: 860 }, r = [];
      SLOTS.forEach((sl, i) => r.push({ id: 'eq:' + sl, slot: sl, x: P.x + 60 + i * STEP, y: P.y + 170, w: CELL, h: CELL }));
      r.push(...bagGrid(P.x + 60, P.y + 340, 'bag', undefined, len, tab), ...tabRow(P.x + 60, P.y + 282, len, 172, 46));
      r.push({ id: 'do', on: true, label: '', x: P.x + 860, y: P.y + P.h - 170, w: 620, h: 72 }, { id: 'close', x: P.x + P.w - 92, y: P.y + 34, w: 52, h: 52 }, { id: 'talk', on: true, label: TXT('UI.craft.talk'), x: P.x + 60, y: P.y + 690, w: 620, h: 64 });
      return { P, r }; },
    // a word with a townsman (TASKS 1016, 1023): a panel over the bottom of the screen, his likeness on the left, his words, a button
    // a quest's page (TASKS 1018) puts its take or turn-in button left of it; a master's talk keeps a way into his workshop; «Поговорить»
    // is on every page of a talk that carries topics, outside them: the row narrows to fit them all right of the likeness (PR 49 review)
    talk: (T) => { const P = { x: 330, y: 540, w: 1260, h: 430 }, last = T && T.p + 1 >= T.pages.length, ids = ['next'];
      if (T && T.act && last) ids.push('act'); if (T && T.craft && !T.menu && !T.inTopic) ids.push('craft'); if (T && T.topics && !T.menu && !T.inTopic) ids.push('talk');
      const gap = 20, w = Math.min(290, Math.floor((P.w - 340 - gap * (ids.length - 1)) / ids.length)), label = { craft: TXT('UI.talk.label'), talk: TXT('UI.talk.talk') };
      const r = ids.map((id, i) => ({ id, label: label[id] || '', on: true, x: P.x + P.w - 40 - w - i * (w + gap), y: P.y + P.h - 92, w, h: 64 }));
      if (T && T.menu) T.topics.forEach((q, i) => r.push({ id: 'topic:' + i, i, label: q.q, on: true, x: P.x + 300, y: P.y + 118 + i * 54, w: 610, h: 48 }));
      // placed by its own size alone, a likeness ran out of its frame at the feet, and a wide one at the side (TASKS 1994)
      const F = { x: P.x + 34, y: P.y + 44, w: 232, h: P.h - 88 }, pad = 10,
        face = (sw, sh) => { const k = Math.min(230 / sh, (F.w - 2 * pad) / sw, (F.h - 2 * pad) / sh), w = sw * k, h = sh * k; return { x: F.x + F.w / 2 - w / 2, y: F.y + F.h - pad - h, w, h }; };
      return { P, r, F, face }; },
    // the notice board on the square (TASKS 1033): every quest on offer now, a row each with its button to take it
    // six rows, one per giver, leave the bottom to the close button
    board: (n) => { const P = { x: 130, y: 60, w: 1660, h: 900 }, r = [];
      for (let i = 0; i < Math.min(n, 6); i++) r.push({ id: 'take:' + i, i, x: P.x + P.w - 250, y: P.y + 136 + i * 104 + 22, w: 200, h: 52 });
      r.push(paperClose(P)); return { P, r }; },
    // the quest journal (TASKS 1023): the run's quests in a column on the left, the chosen one's words on the right
    // past ten quests the list scrolls (TASKS 1884): nine rows from top, the tenth slot says how many more lie above and below
    journal: (n, canDrop, top = 0) => { const P = { x: 330, y: 80, w: 1260, h: 880 }, r = [], many = n > 10, rows = many ? 9 : Math.min(n, 10), t = many ? Math.max(0, Math.min(n - 9, top | 0)) : 0;
      for (let k = 0; k < rows; k++) r.push({ id: 'q:' + (t + k), i: t + k, x: P.x + 30, y: P.y + 110 + k * 68, w: 470, h: 60 });
      if (canDrop) r.push({ id: 'drop', on: true, label: '', x: P.x + P.w - 440, y: P.y + P.h - 116, w: 400, h: 58 });
      r.push({ id: 'notes', on: true, label: '', x: P.x + P.w - 290, y: P.y + 16, w: 230, h: 48 }, paperClose(P));
      return { P, r, top: t, rows, more: many ? { above: t, below: n - t - rows, x: P.x + 30, y: P.y + 110 + 9 * 68, w: 470, h: 60 } : null }; },
    // the first row shown: the one asked, moved just enough to keep the chosen quest (index si) in sight
    journalTop: (n, si, top = 0) => (n <= 10 ? 0 : Math.max(0, Math.min(n - 9, Math.max(si - 8, Math.min(si, top | 0))))),
    notes: (n, page) => { const P = { x: 330, y: 80, w: 1260, h: 880 }, r = [], per = 12, on = Math.min(per, Math.max(0, n - page * per));
      for (let i = 0; i < on; i++) r.push({ id: 'n:' + i, i: page * per + i, x: P.x + 30, y: P.y + 110 + i * 52, w: 470, h: 46 });
      r.push({ id: 'prev', on: page > 0, label: '', x: P.x + 30, y: P.y + P.h - 130, w: 150, h: 52 }, { id: 'next', on: (page + 1) * per < n, label: '', x: P.x + 350, y: P.y + P.h - 130, w: 150, h: 52 });
      r.push(paperClose(P)); return { P, r, per }; },
    // the town's storage chest (TASKS 1012): its cells across the top, the hero's bag under them
    stash: (len, tab) => { const P = { x: 420, y: 90, w: 1080, h: 900 }, x0 = P.x + 80, sx = P.x + P.w - 300;
      const r = grid('stash', STASH.cells, x0, P.y + 190).concat(bagGrid(x0, P.y + 560, 'bag', undefined, len, tab), tabRow(x0, P.y + 504, len, 190));
      r.push({ id: 'close', x: P.x + P.w - 92, y: P.y + 34, w: 52, h: 52 }, ...sortCol('sortS', sx, P.y + 190), ...sortCol('sort', sx, P.y + 560));
      return { P, r }; },
    // the merchant's screen: his shelf (gear, then consumables) and the buy-back row on the left, the hero's bag on the
    // right; every slot has its price line under it
    shop: (nGoods, len, tab) => {
      const P = { x: 190, y: 40, w: 1540, h: 980 }, r = [];
      for (let i = 0; i < nGoods; i++) r.push({ id: 'buy:' + i, i, x: P.x + 60 + (i % 4) * 116, y: P.y + 150 + Math.floor(i / 4) * 118, w: CELL, h: CELL });
      for (let i = 0; i < SHOP.buyback; i++) r.push({ id: 'back:' + i, i, x: P.x + 60 + i * 116, y: P.y + 540, w: CELL, h: CELL });
      r.push(...bagGrid(P.x + 700, P.y + 194, 'sell', 118, len, tab), ...tabRow(P.x + 700, P.y + 140, len, 196, 46));
      r.push({ id: 'talk', on: true, label: TXT('UI.talk.talk'), x: P.x + 250, y: P.y + P.h - 150, w: 260, h: 56 });
      r.push({ id: 'close', x: P.x + P.w - 92, y: P.y + 34, w: 52, h: 52 });
      // the item's card has its own pane under the bag, the merchant and his button moved under his shelf, so the card covers
      // neither the bag's prices nor the button (TASKS 1761)
      const by = Math.max(...r.filter((q) => q.id.startsWith('sell:')).map((q) => q.y + q.h)) + 40, card = { x: P.x + 700, y: by, w: P.w - 740, h: P.y + P.h - 20 - by, bot: 1036 };
      return { P, r, card };
    },
    // a legendary's sale asks first (TASKS 1978): a sheet in the middle of the shop, clear of the merchant's button, «Оставить» on the right
    sellAsk: () => { const A = { x: 660, y: 320, w: 600, h: 380 }, cell = { id: 'sellAsk_it', x: A.x + A.w / 2 - CELL / 2, y: A.y + 56, w: CELL, h: CELL };
      return { A, cell, q: { x: A.x + 40, y: A.y + 150, w: A.w - 80, h: 90 }, r: [{ id: 'sellYes', label: TXT('UI.shop.sellYes'), on: true, x: A.x + 50, y: A.y + A.h - 100, w: 230, h: 64 },
        { id: 'sellNo', label: TXT('UI.shop.sellNo'), on: true, x: A.x + A.w - 280, y: A.y + A.h - 100, w: 230, h: 64 }] }; },
    // how many of a stack (TASKS 1988): the count between − and +, the answer under them, «Отмена» on the right
    split: () => { const A = { x: 710, y: 340, w: 500, h: 340 };
      return { A, cell: { id: 'split_it', x: A.x + A.w / 2 - CELL / 2, y: A.y + 40, w: CELL, h: CELL }, num: { x: A.x + A.w / 2 - 80, y: A.y + 136, w: 160, h: 64 },
        r: [{ id: 'spOk', label: '', on: true, x: A.x + 40, y: A.y + A.h - 96, w: 200, h: 60 }, { id: 'spNo', label: TXT('UI.split.no'), on: true, x: A.x + A.w - 240, y: A.y + A.h - 96, w: 200, h: 60 },
          { id: 'spMinus', label: '\u2212', on: true, x: A.x + A.w / 2 - 150, y: A.y + 140, w: 56, h: 56 }, { id: 'spPlus', label: '+', on: true, x: A.x + A.w / 2 + 94, y: A.y + 140, w: 56, h: 56 }] }; },
    // (TASKS 363: tall and wide enough for the longest question of the pool, the skull door's, at 26 px)
    event: () => { const P = { x: 560, y: 290, w: 800, h: 480 };
      return { P, r: [{ id: 'evYes', label: '', on: true, x: P.x + 40, y: P.y + P.h - 100, w: 300, h: 64 }, { id: 'evNo', label: '', on: true, x: P.x + P.w - 340, y: P.y + P.h - 100, w: 300, h: 64 }] }; },
    // the town's gate out (TASKS 1149): its question and two buttons, the way out on the left
    leave: () => { const P = { x: 610, y: 330, w: 700, h: 330 };
      return { P, r: [{ id: 'go', label: '', on: true, x: P.x + 40, y: P.y + P.h - 100, w: 300, h: 64 }, { id: 'stay', label: TXT('UI.leave.stay'), on: true, x: P.x + P.w - 340, y: P.y + P.h - 100, w: 300, h: 64 }] }; },
    // the town's ring of stones (TASKS 1009): one row per way out, the open portal first, then the waystones by floor
    gate: (n) => { const P = { x: 560, y: 190, w: 800, h: 200 + Math.max(1, n) * 84 + 90 };
      return { P, r: Array.from({ length: n }, (_, i) => ({ id: 'go:' + i, i, x: P.x + 40, y: P.y + 150 + i * 84, w: P.w - 80, h: 72 }))
        .concat([{ id: 'leave', label: TXT('UI.gate.r.leave.label'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 96, w: 300, h: 60 }]) }; },
    // a dungeon altar: its three gifts side by side, cheapest first; with a fourth the page widens, as its words cannot shrink
    // under the font's 20 px floor (TASKS 1861)
    altar: (n = 3) => { const P = n > 3 ? { x: 160, y: 150, w: 1600, h: 780 } : { x: 360, y: 150, w: 1200, h: 780 }, step = 380, cw = 360;
      return { P, r: Array.from({ length: n }, (_, i) => ({ id: 'gift:' + i, i, x: P.x + 40 + i * step, y: P.y + 150, w: cw, h: 410 }))
        .concat([{ id: 'leave', label: TXT('UI.altar.r.leave.label'), on: true, x: P.x + P.w / 2 + 20, y: P.y + P.h - 86, w: 300, h: 60 },
          { id: 'reroll', label: '', on: true, x: P.x + P.w / 2 - 360, y: P.y + P.h - 86, w: 340, h: 60 },
          { id: 'donate', label: TXT('UI.altar.r.donate.label'), on: true, x: P.x + 120, y: P.y + 578, w: 560, h: 64 }]) }; },
  });
})(typeof window !== 'undefined' ? window : globalThis);
