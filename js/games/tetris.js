/**
 * Тетрис — canvas-рендер, стакан 10x20, 7 фигур, превью следующей,
 * сброс, поворот, soft/hard drop, пауза.
 */
import { el, onKey, onSwipe, beep } from '../utils.js';
import { iconEl } from '../icons.js';
import { scores } from '../storage.js';
import { navigate } from '../nav.js';

const COLS = 10, ROWS = 20, CELL = 24;
const ID = 'tetris';

/** Фигуры заданы в координатах своей матрицы + цвет. */
const SHAPES = {
  I: { color: '#37c8d0', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  J: { color: '#4d8bff', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { color: '#ff9f43', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  O: { color: '#ffe14d', cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  S: { color: '#37d39b', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  T: { color: '#a86cff', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  Z: { color: '#ff5c72', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
};
const NAMES = Object.keys(SHAPES);

let board;            // [ROWS][COLS] — null или {color}
let cur, next;        // активная и следующая фигура
let score, lines, level, best;
let dropTimer, paused, dead, raf;
let canvas, ctx, scoreEl, linesEl, levelEl, bestEl, previewEl, overlayEl;

const bag = [];

function nextFromBag() {
  if (!bag.length) {
    // «Мешок» — честная случайность без повторов подряд
    bag.push(...NAMES);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  const name = bag.pop();
  return { name, cells: SHAPES[name].cells.map(([r, c]) => [r, c]) };
}

const colorOf = (name) => SHAPES[name].color;

function spawn() {
  cur = next || nextFromBag();
  next = nextFromBag();
  cur.x = Math.floor((COLS - 3) / 2);
  cur.y = -1;
  if (collides(cur.cells, cur.x, cur.y)) { die(); return; }
  drawPreview();
}

/** Столкновение с полем/дном. */
function collides(cells, ox, oy) {
  for (const [r, c] of cells) {
    const x = ox + c, y = oy + r;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x]) return true;
  }
  return false;
}

function lock() {
  for (const [r, c] of cur.cells) {
    const x = cur.x + c, y = cur.y + r;
    if (y < 0) { die(); return; }
    board[y][x] = { color: colorOf(cur.name) };
  }
  const cleared = clearLines();
  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level;
    level = 1 + Math.floor(lines / 10);
    dropInterval = Math.max(90, 700 - (level - 1) * 65);
    beep(760, 60, 'triangle');
  }
  if (score > best) best = score;
  spawn();
  updateStats();
  draw();
}

/** Удаляет полные строки, возвращает их количество. */
function clearLines() {
  let n = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(Boolean)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      n++;
      r++;
    }
  }
  return n;
}

function die() {
  dead = true;
  paused = false;
  cancelAnimationFrame(raf);
  const isRecord = scores.submit(ID, score);
  if (isRecord) best = score;
  updateStats();
  showDialog('Игра окончена', `Счёт: ${score}${isRecord ? ' — новый рекорд!' : ''}`);
}

let dropInterval = 700;

function move(dx) {
  if (dead || paused) return;
  if (!collides(cur.cells, cur.x + dx, cur.y)) { cur.x += dx; draw(); }
}
function softDrop() {
  if (dead || paused) return;
  if (!collides(cur.cells, cur.x, cur.y + 1)) { cur.y++; score += 1; updateStats(); draw(); }
  else lock();
}
function hardDrop() {
  if (dead || paused) return;
  let d = 0;
  while (!collides(cur.cells, cur.x, cur.y + 1)) { cur.y++; d++; }
  score += d * 2;
  beep(240, 40, 'square');
  lock();
}

/** Поворот на 90° вокруг центра матрицы 3x3. */
function rotate() {
  if (dead || paused || cur.name === 'O') return;
  const size = 3;
  const rotated = cur.cells.map(([r, c]) => [size - 1 - c, r]);
  if (!collides(rotated, cur.x, cur.y)) { cur.cells = rotated; draw(); return; }
  // Пробуем «кик» стены/пола
  for (const shift of [-1, 1, -2, 2]) {
    if (!collides(rotated, cur.x + shift, cur.y)) {
      cur.cells = rotated; cur.x += shift; draw(); return;
    }
  }
}

function togglePause() {
  if (dead) return;
  paused = !paused;
  showPause(paused);
}

function showPause(state) {
  if (state) {
    overlayEl.hidden = false;
    overlayEl.replaceChildren(el('div', { class: 'dialog' },
      el('h2', { text: 'Пауза' }),
      el('p', { text: 'Нажми пробел или кнопку, чтобы продолжить.' }),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', text: 'Продолжить', onclick: togglePause }),
        el('button', { class: 'btn ghost', onclick: () => navigate('home') }, 'В меню'),
      ),
    ));
  } else overlayEl.hidden = true;
}

/* ---------- Рендер ---------- */

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const w = COLS * CELL, h = ROWS * CELL;
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // сетка
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border');
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, h); ctx.stroke(); }
  for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(w, y * CELL); ctx.stroke(); }

  // уложенные блоки
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) block(c, r, board[r][c].color);

  // активная фигура
  if (cur && !dead) for (const [r, c] of cur.cells) {
    if (cur.y + r >= 0) block(cur.x + c, cur.y + r, colorOf(cur.name));
  }
}

function block(cx, cy, color) {
  ctx.fillStyle = color;
  ctx.fillRect(cx * CELL + 1, cy * CELL + 1, CELL - 2, CELL - 2);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(cx * CELL + 1, cy * CELL + 1, CELL - 2, 4);
}

function drawPreview() {
  if (!next) return;
  const color = colorOf(next.name);
  previewEl.replaceChildren(
    ...next.cells.map(([r, c]) => {
      const d = el('div');
      d.style.cssText = `width:18px;height:18px;background:${color};border-radius:4px;margin:2px;position:absolute;left:${(c - 1) * 18}px;top:${r * 18}px`;
      return d;
    }),
  );
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  bestEl.textContent = best;
}

function showDialog(title, text) {
  overlayEl.hidden = false;
  overlayEl.replaceChildren(el('div', { class: 'dialog' },
    el('h2', { text: title }),
    el('p', { text }),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', text: 'Заново', onclick: () => { overlayEl.hidden = true; start(); } }),
      el('button', { class: 'btn ghost', onclick: () => navigate('home') }, 'В меню'),
    ),
  ));
}

function start() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  bag.length = 0;
  score = 0; lines = 0; level = 1; dead = false; paused = false;
  dropInterval = 700;
  next = nextFromBag();
  spawn();
  updateStats();
  draw();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

/** Игровой цикл: фиксированный шаг падения + перерисовка по событию. */
function loop(ts) {
  if (dead) return;
  if (!paused && ts - (loop.last || 0) > dropInterval) {
    loop.last = ts;
    if (!collides(cur.cells, cur.x, cur.y + 1)) { cur.y++; score += 1; updateStats(); draw(); }
    else lock();
  }
  raf = requestAnimationFrame(loop);
}

/* ---------- Точка входа ---------- */
export function render() {
  best = scores.best(ID);
  canvas = el('canvas', { class: 'tet-canvas' });
  ctx = canvas.getContext('2d');
  scoreEl = el('b', { text: 0 });
  linesEl = el('b', { text: 0 });
  levelEl = el('b', { text: 1 });
  bestEl = el('b', { text: best });
  previewEl = el('div', { style: 'position:relative;width:56px;height:56px' });
  overlayEl = el('div', { class: 'overlay', hidden: true });

  const box = (label, node) => el('div', { class: 'tet-box' }, el('span', { text: label }), node);

  const node = el('div', {},
    el('div', { class: 'game-head' },
      el('div', { class: 'game-title' }, iconEl('grid', 22), 'Тетрис'),
      el('div', { class: 'spacer' }),
      el('div', { class: 'stats' },
        box('Счёт', scoreEl), box('Линии', linesEl), box('Уровень', levelEl), box('Рекорд', bestEl),
      ),
    ),
    el('div', { class: 'toolbar' },
      el('button', { class: 'btn primary', onclick: start }, iconEl('rotate', 16), ' Новая игра'),
      el('button', { class: 'btn', text: 'Пауза', onclick: togglePause }),
      el('button', { class: 'btn ghost', onclick: () => navigate('home') }, iconEl('home', 16), ' В меню'),
    ),
    el('div', { class: 'tet-wrap' },
      el('div', { class: 'tet-cols' },
        el('div', { class: 'tet-side' }, el('div', { class: 'tet-box' }, el('span', { text: 'Дальше' }), previewEl)),
        canvas,
      ),
    ),
    el('p', { class: 'foot', text: '← → движение · ↓ ускорить · ↑/X поворот · пробел сбросить · Esc пауза. На телефоне — свайпы и кнопки.' }),
    overlayEl,
  );

  // Мобильные кнопки управления
  const ctl = el('div', { class: 'dpad', style: 'grid-template-columns:repeat(5,52px);grid-template-rows:repeat(2,52px)' },
    el('button', { class: 'btn', style: 'grid-area:1/1', text: '←', onclick: () => move(-1) }),
    el('button', { class: 'btn', style: 'grid-area:1/2', text: '↻', onclick: rotate }),
    el('button', { class: 'btn', style: 'grid-area:1/3', text: '→', onclick: () => move(1) }),
    el('button', { class: 'btn', style: 'grid-area:2/1', text: '↓', onclick: softDrop }),
    el('button', { class: 'btn', style: 'grid-area:2/2', text: '⤓', onclick: hardDrop }),
    el('button', { class: 'btn', style: 'grid-area:2/3', text: '⏸', onclick: togglePause }),
  );
  node.querySelector('.tet-wrap').append(ctl);

  start();

  const KEY = {
    ArrowLeft: () => move(-1), a: () => move(-1),
    ArrowRight: () => move(1), d: () => move(1),
    ArrowDown: () => softDrop(), s: () => softDrop(),
    ArrowUp: () => rotate(), x: () => rotate(), w: () => rotate(),
    ' ': () => hardDrop(), Escape: () => togglePause(),
  };
  const offKey = onKey((e) => {
    const fn = KEY[e.key] || KEY[e.key.toLowerCase?.()];
    if (fn) { e.preventDefault(); fn(); }
  });

  // Свайпы: влево/вправо — сдвиг, вниз — soft, быстрый свайп вниз — hard drop
  let lastSwipe = 0;
  onSwipe(canvas, (dx, dy) => {
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy > 0) {
      if (Date.now() - lastSwipe < 120) hardDrop();
      else softDrop();
    } else rotate();
    lastSwipe = Date.now();
  }, 24);

  return { node, dispose() { cancelAnimationFrame(raf); offKey(); } };
}
