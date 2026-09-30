/** Навигация: клик по «Играть», возврат в меню и вход по прямой ссылке. */
import { root, Node } from './dom-shim.mjs';

let bad = 0;
const errors = [];
process.on('unhandledRejection', (e) => errors.push(e.reason?.message || String(e.reason)));
process.on('uncaughtException', (e) => { errors.push(e.message); console.log('  FAIL необработанное исключение →', e.message); bad++; });

const $in = (cls) => { const out = []; root.app.walk((n) => { if (n instanceof Node && n.hasClass(cls)) out.push(n); }); return out; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' → ' + extra : ''}`); };

/** Заголовок карточки по id маршрута. */
const idTitle = (id) => ({ g2048: '2048', snake: 'Змейка', mines: 'Сапер', tetris: 'Тетрис' }[id]);

/* Сценарий 1: старт на главной, клик по «Играть» */
const { navigate } = await import('../js/nav.js');
await import('../js/app.js');   // регистрирует маршруты
await wait(50);
check('главный экран: 4 карточки', $in('card').length === 4, String($in('card').length));

const games = [['g2048', 'g2048'], ['snake', 'snake-grid'], ['mines', 'mc'], ['tetris', 'tet-canvas']];
for (const [id, marker] of games) {
  // Кнопка «Играть» внутри нужной карточки (их четыре, текст одинаковый)
  const card = $in('card').find((c) => c.children.some((h) => h.textContent.trim() === idTitle(id)));
  const play = card?.children.find((c) => c.textContent === 'Играть');
  check(`${id}: на карточке есть кнопка «Играть»`, !!play);
  play.emit('click');
  await wait(400);
  const n = $in(marker).length;
  check(`${id}: открылся по кнопке «Играть»`, n > 0, `маркер ${marker} — ${n}`);

  const back = $in('btn').find((b) => b.textContent.includes('В меню'));
  back?.emit('click');
  await wait(300);
  check(`${id}: возврат в меню`, $in('card').length === 4 && location.hash === '#/home', location.hash);
}

/* Сценарий 2: вход сразу по прямой ссылке (как при перезагрузке страницы) */
location.hash = '#/g2048';
root.app.replaceChildren();
await navigate('g2048');
await wait(400);
check('прямая ссылка #/g2048 рендерит игру', $in('cell').length === 16, `клеток ${$in('cell').length}`);
check('кнопка «Установить приложение» отсутствует', $in('btn').every((b) => !b.textContent.includes('Установить')));
check('нет необработанных ошибок', errors.length === 0, errors.join(' | '));

console.log(bad ? `\n${bad} провалено` : '\nвсе проверки прошли');
process.exit(bad ? 1 : 0);
