/**
 * Сборщик: складывает ES-модули, CSS и иконки в ОДИН html-файл,
 * который открывается двойным кликом — без сервера.
 *
 * Запуск:  node build.mjs
 * Выход:   dist/offline-arcade.html
 *
 * Почему нельзя просто открыть index.html с диска:
 * браузер блокирует ES-модули по CORS для file:// («Access to script at
 * 'file://…' from origin 'null' has been blocked by CORS policy»).
 * Всё, что должно грузиться с диска, обязано быть inline — тогда
 * ограничение не применяется.
 *
 * Как устроено:
 *   1. Обходим граф импортов от js/app.js.
 *   2. Каждый модуль оборачиваем в IIFE: собственная область видимости,
 *      поэтому одинаковые имена в разных модулях не конфликтуют.
 *   3. Импортированные имена превращаем в const-алиасы вида
 *      «const el = mod_utils.el;», экспорты — в return.
 *   4. import('./games/x.js') превращаем в Promise.resolve(mod_games_x).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(ROOT, 'js/app.js');
const OUT = join(ROOT, 'dist/offline-arcade.html');

/* ------------------------------------------------------------------ *
 * Разбор модулей
 * ------------------------------------------------------------------ */

const RE = {
  // import { a, b as c } from './x.js' | import d from './x.js' | import * as ns from './x.js'
  named: /^import\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]\s*;?$/gm,
  // import './x.js'
  bare: /^import\s*['"]([^'"]+)['"]\s*;?$/gm,
  // dynamic import('./x.js')
  dynamic: /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  // export function f / export const x / export class C
  decl: /^export\s+(?:async\s+function|function|const|let|var|class)\s+([\w$]+)/gm,
  // export { a, b as c }
  list: /^export\s*\{([^}]*)\}\s*;?\s*$/gm,
};

/** Разбирает тело import-выражения: '{ a, b as c }' | 'ns' | 'd' | 'd, { a }' */
function parseSpec(clause) {
  const out = { def: null, ns: null, named: {} };
  const nsMatch = clause.match(/\*\s*as\s+([\w$]+)/);
  if (nsMatch) out.ns = nsMatch[1];

  const braces = clause.match(/\{([^}]*)\}/);
  if (braces) {
    for (const part of braces[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const [orig, , local] = t.split(/\s+/);
      out.named[orig] = local || orig;
    }
  }
  // default-импорт: всё, что не относится к braces/ns
  const rest = clause.replace(/\{[^}]*\}/, '').replace(/\*\s*as\s+[\w$]+/, '').replace(/,\s*$/, '').trim();
  if (rest && /^[A-Za-z_$][\w$]*$/.test(rest)) out.def = rest;
  return out;
}

/** Все статические импорты модуля: [{ spec, def, ns, named }] */
function parseImports(code) {
  const list = [];
  let m;
  RE.named.lastIndex = 0;
  while ((m = RE.named.exec(code))) list.push({ spec: m[2], ...parseSpec(m[1]) });
  RE.bare.lastIndex = 0;
  while ((m = RE.bare.exec(code))) list.push({ spec: m[1], def: null, ns: null, named: {} });
  return list;
}

/** Имена, которые модуль отдаёт наружу. */
function parseExports(code) {
  const out = [];
  let m;
  RE.decl.lastIndex = 0;
  while ((m = RE.decl.exec(code))) out.push(m[1]);
  RE.list.lastIndex = 0;
  while ((m = RE.list.exec(code))) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const [orig, , alias] = t.split(/\s+/);
      out.push(alias ? `${orig}: ${alias}` : orig);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 1. Обход графа импортов
 * ------------------------------------------------------------------ */

const sources = new Map(); // абсолютный путь -> исходный код

async function collect(file) {
  if (sources.has(file)) return;
  const code = await readFile(file, 'utf8');
  sources.set(file, code);
  for (const { spec } of parseImports(code)) {
    if (!spec.startsWith('.')) {
      throw new Error(`Внешний импорт «${spec}» в ${rel(file)} — сборка не поддерживает зависимости извне`);
    }
    await collect(join(dirname(file), spec));
  }
}

const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');
const modId = (f) => 'm_' + rel(f).replace(/\.js$/, '').replace(/[/.]/g, '_');

/* ------------------------------------------------------------------ *
 * 2. Порядок модулей: зависимости раньше зависимых
 * ------------------------------------------------------------------ */

await collect(ENTRY);

const ordered = [];
const done = new Set();
const pathOf = (from, spec) => join(dirname(from), spec);

function visit(file) {
  if (done.has(file)) return;
  done.add(file);
  for (const { spec } of parseImports(sources.get(file))) {
    if (spec.startsWith('.')) visit(pathOf(file, spec));
  }
  ordered.push(file);
}
visit(ENTRY);

// Ленивые import() в app.js тоже входят в граф
for (const spec of [...sources.get(ENTRY).matchAll(RE.dynamic)].map((m) => m[1])) {
  await collect(pathOf(ENTRY, spec));
  visit(pathOf(ENTRY, spec));
}

/* ------------------------------------------------------------------ *
 * 3. Трансформация модуля
 * ------------------------------------------------------------------ */

function transform(file) {
  const code = sources.get(file);
  const imports = parseImports(code).filter((i) => i.spec.startsWith('.'));

  // --- алиасы для импортированных имён ---
  const aliases = [];
  for (const imp of imports) {
    const dep = modId(pathOf(file, imp.spec));
    if (imp.def) aliases.push(`const ${imp.def} = ${dep}.default;`);
    if (imp.ns) aliases.push(`const ${imp.ns} = ${dep};`);
    for (const [orig, local] of Object.entries(imp.named)) aliases.push(`const ${local} = ${dep}.${orig};`);
  }

  // --- тело: убираем import-строки и ключевое слово export ---
  let body = code
    .replace(RE.named, '')
    .replace(RE.bare, '')
    .replace(/^\s*export\s+(?=(?:async\s+function|function|const|let|var|class)\s)/gm, '');

  // Ленивые import() → Promise.resolve(модуль). Модуль уже объявлен выше по графу.
  body = body.replace(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, (whole, spec) =>
    spec.startsWith('.') ? `Promise.resolve(${modId(pathOf(file, spec))})` : whole);

  const names = parseExports(code);
  const ret = names.length ? `\n  return { ${names.join(', ')} };` : '';

  return `/* ${rel(file)} */\nconst ${modId(file)} = (function () {\n`
    + (aliases.length ? aliases.join('\n') + '\n\n' : '')
    + body + ret + '\n})();';
}

const src = ordered.map(transform).join('\n\n');

/* ------------------------------------------------------------------ *
 * 4. CSS, иконка, сборка документа
 * ------------------------------------------------------------------ */

const css = await readFile(join(ROOT, 'css/styles.css'), 'utf8');
const favicon = await readFile(join(ROOT, 'icons/icon.svg'));
const faviconData = 'data:image/svg+xml;base64,' + favicon.toString('base64');

const html = `<!DOCTYPE html>
<html lang="ru" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Offline Arcade — мини-игры офлайн</title>
<meta name="description" content="2048, Змейка, Сапер и Тетрис. Один файл: работает без интернета и без сервера.">
<meta name="theme-color" content="#0b0f19">
<link rel="icon" href="${faviconData}" type="image/svg+xml">
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
/* Собрано build.mjs. Никаких внешних запросов — открывается двойным кликом. */
(function () {
${src}
})();
</script>
</body>
</html>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html, 'utf8');

console.log('Готово: dist/offline-arcade.html');
console.log(`  модулей: ${ordered.length}`);
console.log(`  размер:  ${(Buffer.byteLength(html) / 1024).toFixed(1)} КБ`);
console.log('Открывай двойным кликом — сервер не нужен.');
