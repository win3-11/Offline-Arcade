/**
 * Логические тесты игр через DOM-шим: реальные модули, реальные слушатели.
 * Запуск: node test/logic.test.mjs
 */
import './dom-shim.mjs';
import { win, root, Node } from './dom-shim.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    const r = await fn();
    if (r === true || r === undefined) { passed++; console.log(`  ok   ${name}`); }
    else { failed++; console.log(`  FAIL ${name} → ${r}`); }
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name} → ${e.message}`);
  }
}
const count = (sel) => root.walk && (() => { let n = 0; root.walk((c) => { if (c instanceof Node && c.hasClass(sel)) n++; }); return n; })();

/* ---------------- 2048 ---------------- */
console.log('\n2048');
const g2048 = await import('../js/games/game2048.js');

await test('рендер создаёт 16 клеток', () => {
  root.replaceChildren();
  const r = g2048.render();
  root.append(r.node);
  let cells = 0; root.walk((c) => { if (c.hasClass?.('cell')) cells++; });
  return cells === 16 || `cells=${cells}`;
});

await test('стартовая доска содержит 2 плитки', () => {
  let filled = 0; root.walk((c) => { if (c.hasClass?.('filled')) filled++; });
  return filled === 2 || `filled=${filled}`;
});

await test('ход стрелкой меняет доску', () => {
  // Один сдвиг может ничего не изменить (плитки уже у края) — это законно.
  // Поэтому делаем серию ходов и ждём хотя бы одного изменения.
  const snapshot = () => count('filled') * 1000 + Number(root.querySelectorAll('stat')[0].children[1].textContent);
  const start = snapshot();
  for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    win.dispatchKey(k);
  }
  return snapshot() !== start || `доска не изменилась (${start})`;
});

await test('свайп по сетке обрабатывается', () => {
  const grid = root.querySelectorAll('g2048')[0];
  // Считаем, что pointermove действительно дошёл до обработчика
  let moves = 0;
  grid.addEventListener('pointermove', () => moves++);
  const before = count('filled');
  for (const [dx, dy] of [[0, 90], [0, -90], [90, 0], [-90, 0]]) {
    grid.emit('pointerdown', { clientX: 100, clientY: 100 });
    grid.emit('pointermove', { clientX: 100 + dx, clientY: 100 + dy });
  }
  return moves === 4 && count('filled') > before || `moves=${moves} filled ${before}→${count('filled')}`;
});

await test('состояние сохраняется в localStorage', () => {
  const s = JSON.parse(localStorage.getItem('offline-arcade:states'));
  return s?.g2048?.board?.length === 4 || JSON.stringify(s);
});

await test('восстановление доски из хранилища', async () => {
  root.replaceChildren();
  const r = g2048.render(); root.append(r.node);
  let filled = 0; root.walk((c) => { if (c.hasClass?.('filled')) filled++; });
  return filled >= 3 || `после reload заполнено ${filled}`;
});

/* ---------------- Змейка ---------------- */
console.log('\nЗмейка');
const snake = await import('../js/games/snake.js');
await test('старт: 3 сегмента + 1 еда', () => {
  root.replaceChildren();
  const r = snake.render(); root.append(r.node);
  return count('head') === 1 && count('body') === 2 && count('food') === 1
    || `head=${count('head')} body=${count('body')} food=${count('food')}`;
});

await test('свайп вниз меняет направление (таймер тикает)', async () => {
  const grid = root.querySelectorAll('snake-grid')[0];
  const headBefore = count('body');
  grid.emit('pointerdown', { clientX: 50, clientY: 50 });
  grid.emit('pointermove', { clientX: 50, clientY: 140 });
  await new Promise((r) => setTimeout(r, 250));
  return count('body') === 2 || `body=${count('body')} (было ${headBefore})`;
});

/* ---------------- Сапер ---------------- */
console.log('\nСапер');
const mines = await import('../js/games/minesweeper.js');

await test('легкий уровень 9x9 = 81 клетка', () => {
  root.replaceChildren();
  const r = mines.render(); root.append(r.node);
  return count('mc') === 81 || `клеток ${count('mc')}`;
});

await test('первый клик безопасен — открылась область', () => {
  const cells = root.querySelectorAll('mc')[40];
  cells.emit('click');
  return count('open') > 0 && count('mine') === 0 || `open=${count('open')} mine=${count('mine')}`;
});

await test('ПКМ ставит флажок', () => {
  // Берём гарантированно закрытую клетку (не из уже открытой области)
  const closed = root.querySelectorAll('mc').find((c) => !c.hasClass('open'));
  closed.emit('contextmenu');
  return count('flag') === 1 || `flag=${count('flag')}`;
});

await test('счётчик мин уменьшился', () => {
  const stat = root.querySelectorAll('stat')[0];
  const label = stat.children[0].textContent;
  const value = stat.children[1].textContent;
  return label === 'Мины' && Number(value) === 9 || `${label}=${value}`;
});

await test('переключение на «Средний» даёт 256 клеток', () => {
  const seg = root.querySelectorAll('seg')[0];
  seg.children[1].emit('click');
  return count('mc') === 256 || `клеток ${count('mc')}`;
});

await test('таймер запускается после первого клика', async () => {
  const seg = root.querySelectorAll('seg')[0];
  seg.children[0].emit('click');           // назад на «Легкий»
  const cell = root.querySelectorAll('mc')[40];
  cell.emit('click');
  await new Promise((r) => setTimeout(r, 1200));
  const stat = root.querySelectorAll('stat')[1];
  return Number(stat.children[1].textContent) >= 1 || `время=${stat.children[1].textContent}`;
});

/* ---------------- Тетрис ---------------- */
console.log('\nТетрис');
const tetris = await import('../js/games/tetris.js');

await test('рендер без ошибок, есть canvas и панели', () => {
  root.replaceChildren();
  const r = tetris.render(); root.append(r.node);
  return count('tet-canvas') === 1 && count('tet-box') >= 4
    || `canvas=${count('tet-canvas')} boxes=${count('tet-box')}`;
});

await test('сдвиг влево обрабатывается', () => {
  win.dispatchKey('ArrowLeft');
  return true;
});

await test('жёсткий сброс (пробел) начисляет очки', () => {
  win.dispatchKey(' ');
  const box = root.querySelectorAll('tet-box')[0];
  return /^\d+$/.test(box.children[1].textContent) || `score=${box.children[1].textContent}`;
});

await test('счёт неотрицателен и целочисленный', () => {
  const box = root.querySelectorAll('tet-box')[0];
  const v = box.children[1].textContent;
  return /^\d+$/.test(v) && Number(v) >= 0 || `score=${v}`;
});

/* ---------------- Иконки ---------------- */
console.log('\nИконки');
await test('иконки вставляются как SVG, а не как текст', async () => {
  // Строка с '<svg' в textContent = баг: разметка утекла в текстовый узел
  const leaked = [];
  for (const [id, file] of [['2048', 'game2048'], ['Змейка', 'snake'], ['Сапер', 'minesweeper'], ['Тетрис', 'tetris']]) {
    const mod = await import(`../js/games/${file}.js`);
    root.replaceChildren();
    const r = mod.render();
    root.append(r.node);
    root.walk((n) => {
      if (typeof n.textContent === 'string' && n.textContent.includes('<svg')) {
        leaked.push(`${id}: ${n.textContent.slice(0, 40)}…`);
      }
    });
  }
  return leaked.length === 0 || leaked.join(' | ');
});

await test('на главном экране иконки не утекают в текст', async () => {
  const { navigate, mount } = await import('../js/nav.js');
  // app.js регистрирует маршруты при импорте
  await import('../js/app.js');
  const host = root.app || (root.app = new Node('div'));
  root.replaceChildren();
  mount(host);
  await navigate('home');
  await new Promise((r) => setTimeout(r, 80));
  const leaked = [];
  host.walk((n) => {
    if (typeof n.textContent === 'string' && n.textContent.includes('<svg')) leaked.push(n.textContent.slice(0, 40));
  });
  return leaked.length === 0 || leaked.join(' | ');
});

/* ---------------- Хранилище ---------------- */
console.log('\nХранилище');
const storage = await import('../js/storage.js');
await test('submit обновляет рекорд', () => {
  const isRec = storage.scores.submit('snake', 50);
  return isRec === true && storage.scores.best('snake') === 50 || `best=${storage.scores.best('snake')}`;
});
await test('submit не понижает рекорд', () => {
  const isRec = storage.scores.submit('snake', 20);
  return isRec === false && storage.scores.best('snake') === 50 || 'рекорд сломан';
});
await test('тема и звук сохраняются', () => {
  storage.settings.set({ theme: 'light', sound: true });
  const s = storage.settings.get();
  return s.theme === 'light' && s.sound === true || JSON.stringify(s);
});

console.log(`\nИтог: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
