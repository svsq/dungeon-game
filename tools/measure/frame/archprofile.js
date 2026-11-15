// evalq.mjs body (TASKS 1962): magma_arch's lava under the arch's span, 930–990 × 590–612 — the largest luminance step from one pixel to the next
// along the rows and the columns (a step over 30 is the straight edge of a dark patch), and the whole state's frame as png
const S = (SCENE.QA().states.find((q) => q[0] === 'magma_arch') || [])[1]; SCENE.state = S; SCENE.render(S.t + 0.01);
const cv = document.getElementById('c'), o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const g = o.getContext('2d', { willReadFrequently: true }); g.drawImage(cv, 0, 0);
const [X0, Y0, X1, Y1] = [930, 590, 990, 612], d = g.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data, W = X1 - X0, L = (x, y) => { const i = 4 * (y * W + x); return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
let row = [0], col = [0];
for (let y = 0; y < Y1 - Y0; y++) for (let x = 1; x < W; x++) { const s = Math.abs(L(x, y) - L(x - 1, y)); if (s > row[0]) row = [+s.toFixed(1), X0 + x, Y0 + y]; }
for (let y = 1; y < Y1 - Y0; y++) for (let x = 0; x < W; x++) { const s = Math.abs(L(x, y) - L(x, y - 1)); if (s > col[0]) col = [+s.toFixed(1), X0 + x, Y0 + y]; }
let sum = 0; for (let y = 0; y < Y1 - Y0; y++) for (let x = 0; x < W; x++) sum += L(x, y);
return { maxStepRow: row, maxStepCol: col, meanL: +(sum / (W * (Y1 - Y0))).toFixed(1), png: { magma_arch: o.toDataURL('image/png') } };
