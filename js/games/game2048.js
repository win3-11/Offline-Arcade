/**
 * 2048 — классика на сетке 4x4.
 * Управление: стрелки / WASD / свайпы. Автосохранение в localStorage.
 */
import { el, onSwipe, onKey, beep } from '../utils.js';
import { iconEl } from '../icons.js';
import { scores, saveState } from '../storage.js';
import { navigate } from '../nav.js';

const SIZE = 4;
const GOAL = 2048;
const ID = 'g2048';

/** @type {number[][]} матрица: 0 — пусто */
let board = [];
let score = 0;
let best = 0;
let over = false;
let won = false;
let keepPlaying = false;

/* ---------- Логика ---------- */

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

/** Добавляет плитку 2 (90%) или 4 (10%) в случайную пустую клетку. */
function addTile() {
  const free = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!board[r][c]) free.push([r, c]);
  if (!free.length) return false;
  const [r, c] = free[Math.floor(Math.random() * free.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

/** Сдвиг строки влево с объединением одинаковых соседей. */
function collapseRow(row) {
  const tiles = row.filter(Boolean);
  const out = [];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      score += tiles[i] * 2;
      i++;
    } else out.push(tiles[i]);
  }
  while (out.length < SIZE) out.push(0);
  return out;
}

/** @param {'left'|'right'|'up'|'down'} dir */
function move(dir) {
  if (over) return;

  const next = emptyBoard();
  for (let i = 0; i < SIZE; i++) {
    // Собираем строку/столбец в нужном направлении
    let line = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') line.push(board[i][j]);
      else if (dir === 'right') line.push(board[i][SIZE - 1 - j]);
      else if (dir === 'up') line.push(board[j][i]);
      else line.push(board[SIZE - 1 - j][i]);
    }
    line = collapseRow(line);
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') next[i][j] = line[j];
      else if (dir === 'right') next[i][j] = line[SIZE - 1 - j];
      else if (dir === 'up') next[j][i] = line[j];
      else next[SIZE - 1 - j][i] = line[j];
    }
  }

  // Ход засчитан, только если поле изменилось
  const changed = next.some((row, r) => row.some((v, c) => v !== board[r][c]));
  if (!changed) return;

  board = next;
  addTile();
  beep(300 + Math.min(score, 4000) / 20, 45, 'triangle');

  if (!won && board.flat().includes(GOAL)) {
    won = true;
    setTimeout(showWin, 250);
  }
  if (isDead()) {
    over = true;
    setTimeout(() => showDialog(false), 350);
  }
  paint();
  persist();
}

/** Нет ни одного свободного хода (нет пустых клеток и нет пар). */
function isDead() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) return false;
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return false;
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return false;
    }
  return true;
}

/* ---------- Сохранение ---------- */
function persist() {
  saveState.save(ID, { board, score, won, keepPlaying, over });
}

function restore() {
  const s = saveState.load(ID);
  if (s?.board?.length === SIZE) {
    ({ board, won, keepPlaying, over } = s);
    score = s.score || 0;
    return true;
  }
  return false;
}

function newGame() {
  board = emptyBoard();
  score = 0; over = false; won = false; keepPlaying = false;
  addTile(); addTile();
  saveState.clear(ID);
  paint();
}

/* ---------- UI ---------- */
let gridEl, scoreEl, bestEl, overlayEl;

function paint() {
  best = Math.max(best, score);
  bestEl.textContent = best;
  scoreEl.textContent = score;

  gridEl.replaceChildren(
    ...board.flatMap((row, r) =>
      row.map((v, c) => {
        const cell = el('div', { class: 'cell', 'data-v': v || '' , text: v || '' });
        if (v) cell.classList.add('filled');
        if (v === GOAL) cell.classList.add('won');
        return cell;
      }),
    ),
  );
}

function showDialog(win) {
  const isRecord = scores.submit(ID, score);
  if (isRecord) best = Math.max(best, score);

  overlayEl.hidden = false;
  overlayEl.replaceChildren(el('div', { class: 'dialog' },
    el('h2', { text: win ? 'Победа!' : 'Ходов нет' }),
    el('p', { text: `Счёт: ${score}${isRecord ? ' — новый рекорд!' : ''}` }),
    el('div', { class: 'row' },
      el('button', {
        class: 'btn primary', text: win && !keepPlaying ? 'Продолжить' : 'Новая игра',
        onclick: () => {
          overlayEl.hidden = true;
          if (win && !keepPlaying) { keepPlaying = true; persist(); return; }
          newGame();
        },
      }),
      el('button', {
        class: 'btn ghost', text: 'На главную',
        onclick: () => navigate('home'),
      }),
    ),
  ));
}

function showWin() {
  if (keepPlaying) return;
  showDialog(true);
}

export function render() {
  best = scores.best(ID);
  if (!restore()) { board = emptyBoard(); addTile(); addTile(); }

  scoreEl = el('b', { text: score });
  bestEl = el('b', { text: best });
  gridEl = el('div', { class: 'g2048', role: 'grid' });
  overlayEl = el('div', { class: 'overlay', hidden: true });

  const node = el('div', {},
    el('div', { class: 'game-head' },
      el('div', { class: 'game-title' }, iconEl('grid', 22), '2048'),
      el('div', { class: 'spacer' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Счёт' }), scoreEl),
        el('div', { class: 'stat' }, el('span', { text: 'Рекорд' }), bestEl),
      ),
    ),
    el('div', { class: 'toolbar' },
      el('button', { class: 'btn primary', onclick: newGame },
        iconEl('rotate', 16), ' Новая игра'),
      el('button', { class: 'btn ghost', onclick: () => navigate('home') },
        iconEl('home', 16), ' В меню'),
    ),
    el('div', { class: 'board-wrap' }, gridEl),
    el('p', { class: 'foot', text: 'Стрелки или WASD. На телефоне — свайпы по полю.' }),
    overlayEl,
  );

  paint();

  // --- Ввод ---
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
  };
  const offKey = onKey((e) => {
    const dir = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
    if (dir) { e.preventDefault(); move(dir); }
  });

  onSwipe(gridEl, (dx, dy) => {
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  return {
    node,
    dispose() { offKey(); persist(); },
  };
}
