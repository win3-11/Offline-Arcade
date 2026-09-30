/**
 * Змейка — поле 20x20, еда, счёт, ускорение при росте, свайпы и D-pad.
 */
import { el, onSwipe, onKey, beep } from '../utils.js';
import { iconEl } from '../icons.js';
import { scores } from '../storage.js';
import { navigate } from '../nav.js';

const N = 20;
const ID = 'snake';
const BASE_STEP = 150;  // мс на шаг в начале, мс
const MIN_STEP = 60;    // максимальная скорость

let snake, dir, nextDir, food, score, best, dead, timer, gridEl, scoreEl, bestEl, overlayEl, paused;

/** Стартовая скорость растёт вместе со счётом. */
const stepFor = (sc) => Math.max(MIN_STEP, BASE_STEP - sc * 2);

function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = nextDir = { x: 1, y: 0 };
  score = 0; dead = false; paused = false;
  placeFood();
}

function placeFood() {
  let f;
  do {
    f = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
  } while (snake.some((s) => s.x === f.x && s.y === f.y));
  food = f;
}

/** Разворот на 180° запрещён — иначе змейка «съедает» себя в один ход. */
function setDir(d) {
  if (d.x === -dir.x && d.y === -dir.y) return;
  nextDir = d;
}

function tick() {
  if (dead || paused) return;
  dir = nextDir;

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Стена = смерть
  if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N) return die();
  // Хвост = смерть (клетка хвоста освободится — её не считаем)
  if (snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y)) return die();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    beep(660, 50, 'square');
    placeFood();
  } else {
    snake.pop();
  }

  paint();
  clearTimeout(timer);
  timer = setTimeout(tick, stepFor(score));
}

function die() {
  dead = true;
  beep(160, 220, 'sawtooth');
  const isRecord = scores.submit(ID, score);
  if (isRecord) best = score;
  paint();
  overlayEl.hidden = false;
  overlayEl.replaceChildren(el('div', { class: 'dialog' },
    el('h2', { text: 'Игра окончена' }),
    el('p', { text: `Счёт: ${score}${isRecord ? ' — новый рекорд!' : ''}` }),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', text: 'Заново', onclick: start }),
      el('button', { class: 'btn ghost', onclick: () => navigate('home') }, 'В меню'),
    ),
  ));
}

function start() {
  reset();
  overlayEl.hidden = true;
  paint();
  clearTimeout(timer);
  timer = setTimeout(tick, BASE_STEP);
}

function togglePause() {
  if (dead) return;
  paused = !paused;
  if (!paused) timer = setTimeout(tick, stepFor(score));
}

function paint() {
  best = Math.max(best, score);
  scoreEl.textContent = score;
  bestEl.textContent = best;

  const cells = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let cls = 'snake-cell';
      if (x === food.x && y === food.y) cls += ' food';
      else if (x === snake[0].x && y === snake[0].y) cls += ' head';
      else if (snake.some((s) => s.x === x && s.y === y)) cls += ' body';
      cells.push(el('div', { class: cls }));
    }
  gridEl.replaceChildren(...cells);
}

export function render() {
  best = scores.best(ID);
  reset();

  scoreEl = el('b', { text: 0 });
  bestEl = el('b', { text: best });
  gridEl = el('div', { class: 'snake-grid' });
  overlayEl = el('div', { class: 'overlay', hidden: true });

  const DIRS = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } };
  const dpad = el('div', { class: 'dpad' },
    el('button', { class: 'btn u', 'aria-label': 'Вверх', text: '▲', onclick: () => setDir(DIRS.u) }),
    el('button', { class: 'btn l', 'aria-label': 'Влево', text: '◀', onclick: () => setDir(DIRS.l) }),
    el('button', { class: 'btn r', 'aria-label': 'Вправо', text: '▶', onclick: () => setDir(DIRS.r) }),
    el('button', { class: 'btn dn', 'aria-label': 'Вниз', text: '▼', onclick: () => setDir(DIRS.d) }),
  );

  const node = el('div', {},
    el('div', { class: 'game-head' },
      el('div', { class: 'game-title' }, iconEl('grid', 22), 'Змейка'),
      el('div', { class: 'spacer' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Счёт' }), scoreEl),
        el('div', { class: 'stat' }, el('span', { text: 'Рекорд' }), bestEl),
      ),
    ),
    el('div', { class: 'toolbar' },
      el('button', { class: 'btn primary', onclick: start }, iconEl('rotate', 16), ' Заново'),
      el('button', { class: 'btn', onclick: togglePause, text: 'Пауза' }),
      el('button', { class: 'btn ghost', onclick: () => navigate('home') }, iconEl('home', 16), ' В меню'),
    ),
    el('div', { class: 'snake-wrap' }, gridEl, dpad),
    el('p', { class: 'foot', text: 'Стрелки / WASD или свайпы. Чем длиннее змейка — тем быстрее.' }),
    overlayEl,
  );

  paint();
  start();

  const KEYMAP = {
    ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
    w: 'u', s: 'd', a: 'l', d: 'r',
  };
  const offKey = onKey((e) => {
    const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
    if (k) { e.preventDefault(); setDir(DIRS[k]); }
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePause(); }
  });

  onSwipe(gridEl, (dx, dy) => {
    setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.r : DIRS.l) : (dy > 0 ? DIRS.d : DIRS.u));
  });

  return {
    node,
    dispose() { clearTimeout(timer); offKey(); },
  };
}
