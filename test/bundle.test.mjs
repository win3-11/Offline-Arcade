/**
 * Проверка single-file сборки: вытаскиваем <script> и <style> и
 * исполняем код в DOM-шиме — так же, как это сделает браузер.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist/offline-arcade.html');

let bad = 0;
const check = (name, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' → ' + extra : ''}`); };

const html = readFileSync(DIST, 'utf8');

console.log('Структура файла');
check('один <html>', (html.match(/<html/g) || []).length === 1);
check('есть #app', html.includes('id="app"'));
check('CSS встроен', html.includes('<style>') && html.includes('.g2048'));
check('иконка через data:', html.includes('data:image/svg+xml;base64,'));
check('нет внешних ссылок на .js', !/<script[^>]+src=/.test(html), (html.match(/<script[^>]+src="[^"]+"/) || [])[0]);
check('нет внешних ссылок на .css', !/<link[^>]+stylesheet/.test(html));
check('нет fetch/import() в рантайме', !/\bimport\s*\(/.test(html.split('<script>')[1] || ''));

const script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
console.log('\nСкрипт');
check('нет import-строк', !/^\s*import\s/m.test(script));
// export допустим только внутри строковых литералов (например, в тексте подсказок)
const realExports = script.split('\n').filter((l) => /^\s*export\s+(?:default|\{|\*|const|let|var|function|class|async)/.test(l));
check('нет export-строк', realExports.length === 0, realExports[0] || '');
check('CSS без внешних url()', !/url\(\s*['"]?(?:https?:)?\/\//.test(css));
check('модулей 10', (script.match(/\/\* js\//g) || []).length === 10, String((script.match(/\/\* js\//g) || []).length));

/* Синтаксическая проверка всего скрипта */
console.log('\nСинтаксис');
const tmp = join(mkdtempSync(join(tmpdir(), 'bundle-')), 'bundle.js');
writeFileSync(tmp, script, 'utf8');
const syntax = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
check('скрипт парсится', syntax.status === 0, (syntax.stderr || '').split('\n').slice(0, 3).join(' '));

/* Запуск в DOM-шиме: проверяем, что приложение реально оживает */
console.log('\nЗапуск без сервера');
const runner = join(mkdtempSync(join(tmpdir(), 'run-')), 'run.mjs');
writeFileSync(runner, `
import { pathToFileURL } from 'node:url';
import { root, Node } from '${pathToFileURL(join(ROOT, 'test/dom-shim.mjs')).href}';
// file://-режим: протокол не http, Service Worker не трогаем
globalThis.location.protocol = 'file:';

const errors = [];
process.on('uncaughtException', (e) => errors.push(e.message));
process.on('unhandledRejection', (e) => errors.push(e.reason?.message || String(e.reason)));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $in = (c) => { const o = []; (root.app || root).walk((n) => { if (n instanceof Node && n.hasClass(c)) o.push(n); }); return o; };

// Вырезаем весь собранный скрипт и исполняем его
const html = ${JSON.stringify(html)};
const script = html.match(/<script>([\\s\\S]*?)<\\/script>/)[1];
globalThis.location.hash = '';
new Function(script)();
await wait(200);

const out = { errors, cards: $in('card').length, hash: location.hash, games: {} };
if (out.cards === 4) {
  const byTitle = { '2048': 'g2048', 'Змейка': 'snake', 'Сапер': 'mines', 'Тетрис': 'tetris' };
  const markers = { g2048: 'cell', snake: 'snake-grid', mines: 'mc', tetris: 'tet-canvas' };
  for (const [title, id] of Object.entries(byTitle)) {
    const card = $in('card').find((c) => c.children.some((h) => h.textContent.trim() === title));
    card?.children.find((c) => c.textContent === 'Играть')?.emit('click');
    await wait(400);
    out.games[id] = $in(markers[id]).length;
    $in('btn').find((b) => b.textContent.includes('В меню'))?.emit('click');
    await wait(300);
  }
  out.backToHome = $in('card').length === 4;
}
console.log(JSON.stringify(out));
`, 'utf8');

const run = spawnSync(process.execPath, [runner], { encoding: 'utf8' });
const outText = (run.stdout || '').trim().split('\n').pop();
let data = {};
try { data = JSON.parse(outText); } catch { /* выведем ниже */ }

check('карточек на главной: 4', data.cards === 4, JSON.stringify(data));
check('все 4 игры открываются в сборке',
  data.games && data.games.g2048 === 16 && data.games.snake === 1 && data.games.mines === 81 && data.games.tetris === 1,
  JSON.stringify(data.games));
check('возврат в меню работает', data.backToHome === true);
check('нет ошибок в file://-режиме', (data.errors || []).length === 0, (data.errors || []).join(' | '));
if (!data.cards) console.log('  вывод:', run.stdout, run.stderr);

console.log(bad ? `\n${bad} провалено` : '\nсборка работает без сервера');
process.exit(bad ? 1 : 0);
