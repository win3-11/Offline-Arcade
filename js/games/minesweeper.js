/**
 * Сапер — три сложности, безопасный первый клик, таймер, флажки
 * (ПКМ на десктопе, долгий тап на тач-устройствах).
 *
 * Модель клетки — объект, чтобы не путать число рядом с признаком
 * «открыто»: { mine, near, open, flag, reveal }
 */
import { el, beep } from '../utils.js';
import { iconEl } from '../icons.js';
import { saveState } from '../storage.js';
import { navigate } from '../nav.js';

const ID = 'mines';

export const LEVELS = {
  easy: { cols: 9, rows: 9, mines: 10, label: 'Легкий' },
  mid: { cols: 16, rows: 16, mines: 40, label: 'Средний' },
  hard: { cols: 24, rows: 16, mines: 70, label: 'Сложный' },
};

let level = 'easy';
let cells;           // клетки [r][c]
let started;         // мины расставлены?
let dead, finished;  // результат партии
let elapsed = 0, timer = null;
let gridEl, minesEl, timeEl, bestEl, overlayEl;
let bestTime = null;

/* ---------- Генерация поля ---------- */

const inside = (r, c, rows, cols) => r >= 0 && c >= 0 && r < rows && c < cols;

function build() {
  const L = LEVELS[level];
  cells = Array.from({ length: L.rows }, () =>
    Array.from({ length: L.cols }, () => ({ mine: false, near: 0, open: false, flag: false })),
  );
  started = false; dead = false; finished = false;
  elapsed = 0;
  stopTimer();
}

/**
 * Ставит мины так, чтобы первая открытая клетка и её 8 соседей остались чистыми.
 * Кандидаты — всё поле минус защищённая зона (крест и вокруг креста).
 */
function placeMines(safeR, safeC) {
  const L = LEVELS[level];

  // Защищённая зона: крест вокруг первого клика + пояс вокруг креста
  const protectedZone = new Set();
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      for (let ar = -1; ar <= 1; ar++)
        for (let ac = -1; ac <= 1; ac++) {
          const r = safeR + dr + ar, c = safeC + dc + ac;
          if (inside(r, c, L.rows, L.cols)) protectedZone.add(`${r},${c}`);
        }
    }

  const pool = [];
  for (let r = 0; r < L.rows; r++)
    for (let c = 0; c < L.cols; c++)
      if (!protectedZone.has(`${r},${c}`)) pool.push([r, c]);

  const take = Math.min(L.mines, pool.length);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (let i = 0; i < take; i++) cells[pool[i][0]][pool[i][1]].mine = true;

  for (let r = 0; r < L.rows; r++)
    for (let c = 0; c < L.cols; c++) {
      if (cells[r][c].mine) continue;
      cells[r][c].near = countAround(r, c, L);
    }
}

function countAround(r, c, L) {
  let n = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (inside(r + dr, c + dc, L.rows, L.cols) && cells[r + dr][c + dc].mine) n++;
    }
  return n;
}

/* ---------- Таймер ---------- */
function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    if (dead || finished || elapsed >= 999) return;
    elapsed++;
    timeEl.textContent = elapsed;
  }, 1000);
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

/* ---------- Действия ---------- */

function open(r, c) {
  const L = LEVELS[level];
  if (dead || finished) return;
  const cell = cells[r][c];
  if (cell.open || cell.flag) return;

  // Первый клик — расставляем мины, гарантируя безопасность этой клетки
  if (!started) {
    placeMines(r, c);
    started = true;
    startTimer();
    saveState.save(ID, { level });
  }

  if (cell.mine) { lose(r, c); return; }

  // Раскрываем островок нулей итеративно (без риска переполнения стека)
  const stack = [[r, c]];
  while (stack.length) {
    const [rr, cc] = stack.pop();
    const cur = cells[rr][cc];
    if (cur.open || cur.flag || cur.mine) continue;
    cur.open = true;
    paintCell(rr, cc);
    if (cur.near === 0) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) {
            const nr = rr + dr, nc = cc + dc;
            if (inside(nr, nc, L.rows, L.cols)) stack.push([nr, nc]);
          }
        }
    }
  }

  if (countClosed() === 0) win();
  updateCounters();
}

function toggleFlag(r, c) {
  if (dead || finished) return;
  const cell = cells[r][c];
  if (cell.open) return;
  cell.flag = !cell.flag;
  beep(cell.flag ? 520 : 380, 40);
  paintCell(r, c);
  updateCounters();
}

/** Сколько не-мин ещё закрыто. */
function countClosed() {
  let n = 0;
  for (const row of cells) for (const cell of row) if (!cell.open && !cell.mine) n++;
  return n;
}

function lose(br, bc) {
  dead = true;
  stopTimer();
  beep(110, 320, 'sawtooth');
  for (let r = 0; r < cells.length; r++)
    for (let c = 0; c < cells[0].length; c++) {
      const cell = cells[r][c];
      if (cell.mine) cell.reveal = r === br && c === bc ? 'boom' : 'mine';
      else if (cell.flag) cell.reveal = 'wrong';
    }
  paint();
  showDialog('Проиграли', `Время: ${elapsed} с`);
}

function win() {
  finished = true;
  stopTimer();
  const isRecord = bestTime === null || elapsed < bestTime;
  if (isRecord) {
    bestTime = elapsed;
    bestEl.textContent = elapsed;
    saveState.save(ID + ':time', { bestTime });
  }
  beep(880, 140, 'triangle');
  paint();
  showDialog('Победа!', `Время: ${elapsed} с${isRecord ? ' — рекорд!' : ''}`);
}

const flagCount = () => cells.flat().filter((c) => c.flag).length;

function updateCounters() {
  minesEl.textContent = LEVELS[level].mines - flagCount();
  timeEl.textContent = elapsed;
}

function showDialog(title, text) {
  overlayEl.hidden = false;
  overlayEl.replaceChildren(el('div', { class: 'dialog' },
    el('h2', { text: title }),
    el('p', { text }),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', text: 'Заново', onclick: () => { overlayEl.hidden = true; newGame(level); } }),
      el('button', { class: 'btn ghost', onclick: () => navigate('home') }, 'В меню'),
    ),
  ));
}

/* ---------- Отрисовка ---------- */

function cellClass(cell) {
  const base = 'mc';
  if (cell.reveal === 'boom' || cell.reveal === 'mine') return base + ' mine';
  if (cell.reveal === 'wrong') return base + ' open';
  if (cell.flag) return base + ' flag';
  if (cell.open) return base + ' open' + (cell.near ? ' n' + cell.near : '');
  return base;
}

function cellText(cell) {
  if (cell.reveal === 'boom') return '💥';
  if (cell.reveal === 'mine') return '💣';
  if (cell.reveal === 'wrong') return '✖';
  if (cell.flag) return '🚩';
  if (cell.open && cell.near) return String(cell.near);
  return '';
}

function paintCell(r, c) {
  const node = gridEl.children[r * cells[0].length + c];
  if (!node) return;
  const cell = cells[r][c];
  node.className = cellClass(cell);
  node.textContent = cellText(cell);
}

function paint() {
  const L = LEVELS[level];
  gridEl.style.gridTemplateColumns = `repeat(${L.cols}, auto)`;
  gridEl.replaceChildren();
  for (let r = 0; r < L.rows; r++)
    for (let c = 0; c < L.cols; c++) {
      const cell = cells[r][c];
      const btn = el('button', {
        class: cellClass(cell),
        'aria-label': `Клетка ${r + 1}:${c + 1}`,
        text: cellText(cell),
      });
      wireCell(btn, r, c);
      gridEl.append(btn);
    }
  updateCounters();
}

function wireCell(btn, r, c) {
  btn.addEventListener('click', (e) => { e.preventDefault(); open(r, c); });
  btn.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleFlag(r, c); });

  // Долгий тап на мобильных = флажок
  let hold = null;
  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    hold = setTimeout(() => { hold = null; toggleFlag(r, c); }, 420);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
    btn.addEventListener(ev, () => { if (hold) { clearTimeout(hold); hold = null; } });
  }
}

/* ---------- Жизненный цикл ---------- */

function newGame(lv) {
  level = lv || level;
  build();
  overlayEl.hidden = true;
  saveState.clear(ID);
  paint();
}

export function render() {
  level = saveState.load(ID)?.level || 'easy';
  bestTime = saveState.load(ID + ':time')?.bestTime ?? null;

  minesEl = el('b', { text: LEVELS[level].mines });
  timeEl = el('b', { text: 0 });
  bestEl = el('b', { text: bestTime ?? '—' });
  gridEl = el('div', { class: 'mine-grid' });
  overlayEl = el('div', { class: 'overlay', hidden: true });

  const seg = el('div', { class: 'seg' });
  for (const [key, cfg] of Object.entries(LEVELS)) {
    seg.append(el('button', {
      'aria-pressed': String(key === level),
      text: cfg.label,
      onclick: (e) => {
        [...seg.children].forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        newGame(key);
      },
    }));
  }

  const node = el('div', {},
    el('div', { class: 'game-head' },
      el('div', { class: 'game-title' }, iconEl('grid', 22), 'Сапер'),
      el('div', { class: 'spacer' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Мины' }), minesEl),
        el('div', { class: 'stat' }, el('span', { text: 'Время' }), timeEl),
        el('div', { class: 'stat' }, el('span', { text: 'Рекорд' }), bestEl),
      ),
    ),
    el('div', { class: 'toolbar' },
      seg,
      el('button', { class: 'btn primary', onclick: () => newGame(level) }, iconEl('rotate', 16), ' Заново'),
      el('button', { class: 'btn ghost', onclick: () => navigate('home') }, iconEl('home', 16), ' В меню'),
    ),
    el('div', { class: 'mine-wrap' }, gridEl),
    el('p', { class: 'foot', text: 'ПКМ или долгий тап — флажок. Первый клик всегда безопасный.' }),
    overlayEl,
  );

  newGame(level);
  return { node, dispose() { stopTimer(); } };
}
