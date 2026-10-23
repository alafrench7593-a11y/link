// IRLY campaign kit helpers. The wordmark is built from the app's own dot glyphs (src/brand/dots.ts).
const GLYPHS = {
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
};

// <div data-logo="64" data-ink="#fff" data-accent="#FF453A"></div>: caps about 64 px tall.
function wordmark(size, ink, accent) {
  const dots = [];
  let x = 0;
  for (const ch of 'IRLY') {
    const g = GLYPHS[ch];
    g.forEach((line, row) => [...line].forEach((c, col) => c === '#' && dots.push([x + col, row, false])));
    x += g[0].length + 1;
  }
  [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([c, r]) => dots.push([x - 0.4 + c, -2.2 + r, true]));
  const pitch = size / 6.2;
  const w = (x + 1.6) * pitch;
  const h = 9.2 * pitch;
  const circles = dots
    .map(([c, r, a]) => `<circle cx="${(c + 0.5) * pitch}" cy="${(r + 2.2 + 0.5) * pitch}" r="${pitch * 0.44}" fill="${a ? accent : ink}"/>`)
    .join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="IRLY">${circles}</svg>`;
}

function crop(el) {
  const { src, x, y, w, h } = el.dataset;
  const width = parseFloat(el.style.width);
  const s = width / Number(w);
  el.style.height = `${Number(h) * s}px`;
  el.innerHTML = `<img src="${src}" style="width:${390 * s}px;left:${-Number(x) * s}px;top:${-Number(y) * s}px" alt="">`;
}

document.querySelectorAll('[data-logo]').forEach((el) => {
  el.innerHTML = wordmark(Number(el.dataset.logo), el.dataset.ink || '#FFFFFF', el.dataset.accent || el.dataset.ink || '#FFFFFF');
});
document.querySelectorAll('.crop[data-src]').forEach(crop);

window.__ready = Promise.all([
  document.fonts.ready,
  ...[...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))),
]);
