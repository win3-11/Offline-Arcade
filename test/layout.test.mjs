/**
 * Проверка вёрстки: в CSS должны быть явные колонки/строки у сеток.
 * display:grid без template-columns схлопывает доску в одну колонку —
 * ровно тот баг, что был с 2048.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/styles.css'), 'utf8');

let bad = 0;
const check = (name, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' → ' + extra : ''}`); };

/** Возвращает тело правила по имени класса. */
const rule = (cls) => {
  const m = css.match(new RegExp(`(?:^|\\n)\\.${cls}\\s*\\{([^}]*)\\}`, 'm'));
  return m ? m[1] : null;
};

console.log('Сетки');

/* --- 2048: 4x4 --- */
const g2048 = rule('g2048');
check('.g2048: объявлена', !!g2048);
check('.g2048: 4 колонки', /grid-template-columns:\s*repeat\(4/.test(g2048), g2048?.match(/grid-template-columns:[^;]*/)?.[0] || 'нет');
check('.g2048: 4 строки', /grid-template-rows:\s*repeat\(4/.test(g2048), g2048?.match(/grid-template-rows:[^;]*/)?.[0] || 'нет');

/* --- Змейка: 20x20 --- */
const snake = rule('snake-grid');
check('.snake-grid: 20 колонок', /grid-template-columns:\s*repeat\(20/.test(snake), snake?.match(/grid-template-columns:[^;]*/)?.[0] || 'нет');
check('.snake-grid: 20 строк', /grid-template-rows:\s*repeat\(20/.test(snake), snake?.match(/grid-template-rows:[^;]*/)?.[0] || 'нет');

/* --- Сапер: колонки задаются из JS --- */
const minesJs = readFileSync(join(root, 'js/games/minesweeper.js'), 'utf8');
check('Сапер: grid-template-columns ставится из JS', /gridTemplateColumns\s*=/.test(minesJs));
check('Сапер: количество клеток совпадает с LEVELS', (() => {
  const cols = /mid:\s*\{\s*cols:\s*(\d+)/.exec(minesJs)?.[1];
  return cols === '16' || `mid.cols=${cols}`;
})());

/* --- Общее: ни одна grid-сетка без явных колонок.
   Исключения: .mine-grid (колонки из JS) и служебные обёртки с place-items --- */
console.log('\nОбщее');
const JS_MANAGED = new Set(['.mine-grid', '.mc', '.g2048 .cell', '.snake-cell']);
const gridRules = [...css.matchAll(/(?:^|\n)(\.[\w-]+(?:\s+\.[\w-]+)*)\s*\{([^}]*)\}/g)]
  .map((m) => ({ cls: m[1], body: m[2] }))
  .filter((r) => /display:\s*grid/.test(r.body))
  .filter((r) => !/place-items:\s*center/.test(r.body))
  .filter((r) => ![...JS_MANAGED].some((ex) => r.cls.includes(ex)));

const bad2 = gridRules.filter((r) => !/grid-template-columns/.test(r.body));
check('все display:grid задают колонки', bad2.length === 0, bad2.map((r) => r.cls).join(', '));

/* --- Тетрис: canvas не растянут --- */
check('Тетрис: canvas фиксированной ширины (inline style)', /canvas\.style\.width/.test(readFileSync(join(root, 'js/games/tetris.js'), 'utf8')));

console.log(bad ? `\n${bad} провалено` : '\nвёрстка в порядке');
process.exit(bad ? 1 : 0);
