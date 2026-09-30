/**
 * Точка входа: маршруты, главный экран, тема, Service Worker.
 *
 * Роутинг и переходы живут в nav.js — здесь только их регистрация и оболочка.
 */
import { el, $ } from './utils.js';
import { icon } from './icons.js';
import { settings, scores } from './storage.js';
import { register, mount, navigate } from './nav.js';
import { GAMES } from './games/index.js';

/* ---------- Маршруты ---------- */
register('home', { title: 'Offline Arcade', render: renderHome });
// load — ленивый импорт модуля игры (работает и в собранном single-file)
register('g2048', { title: '2048', load: () => import('./games/game2048.js'), render: (m) => m.render() });
register('snake', { title: 'Змейка', load: () => import('./games/snake.js'), render: (m) => m.render() });
register('mines', { title: 'Сапер', load: () => import('./games/minesweeper.js'), render: (m) => m.render() });
register('tetris', { title: 'Тетрис', load: () => import('./games/tetris.js'), render: (m) => m.render() });

/* ---------- Тема ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b0f19' : '#f4f6fb');
  paintHeaderButtons();
}

/** Кнопки темы и звука живут в слотах шапки — заполняем их после рендера. */
function paintHeaderButtons() {
  const cfg = settings.get();

  const themeSlot = document.querySelector('.theme-slot');
  themeSlot?.replaceChildren(el('button', {
    class: 'icon-btn', title: 'Сменить тему', 'aria-label': 'Сменить тему',
    html: icon(cfg.theme === 'dark' ? 'sun' : 'moon'),
    onclick: () => applyTheme(settings.get().theme === 'dark' ? 'light' : 'dark'),
  }));

  const soundSlot = document.querySelector('.sound-slot');
  soundSlot?.replaceChildren(el('button', {
    class: 'icon-btn', title: 'Звук', 'aria-label': 'Переключить звук',
    text: cfg.sound ? '🔊' : '🔇',
    onclick: () => { settings.set({ sound: !settings.get().sound }); paintHeaderButtons(); },
  }));
}

/* ---------- Главный экран ---------- */
function renderHome() {
  const wrap = el('div', {});

  wrap.append(el('section', { class: 'hero' },
    el('h1', { text: 'Мини-игры, всегда под рукой' }),
    el('p', { text: 'Четыре игры, zero-install и полностью офлайн: ассеты кеширует Service Worker, прогресс и рекорды хранятся локально.' }),
    el('div', { class: 'badge-row' },
      el('span', { class: 'badge', text: '2048' }),
      el('span', { class: 'badge', text: 'Змейка' }),
      el('span', { class: 'badge', text: 'Сапер' }),
      el('span', { class: 'badge', text: 'Тетрис' }),
      el('span', { class: 'badge', text: 'PWA · offline-first' }),
    ),
  ));

  const grid = el('div', { class: 'grid-cards' });
  for (const g of GAMES) {
    grid.append(el('article', { class: 'card' },
      el('div', { class: 'thumb', style: `background:${g.gradient}`, text: g.short }),
      el('h3', { text: g.title }),
      el('p', { text: g.desc }),
      el('div', { class: 'meta' },
        el('span', { html: `${icon('trophy', 14)} Рекорд: <b>${scores.best(g.id)}</b>` }),
      ),
      el('button', { class: 'btn primary', text: 'Играть', onclick: () => navigate(g.id) }),
    ));
  }
  wrap.append(grid);
  wrap.append(el('p', { class: 'foot', text: 'Стрелки / WASD — управление, свайпы и экранные кнопки — на телефоне.' }));

  return wrap;
}

/* ---------- Старт ---------- */
applyTheme(settings.get().theme);
mount($('#app'));

/**
 * Показываем необработанные ошибки прямо в интерфейсе:
 * иначе сбой выглядит как «ничего не нажимается».
 */
function showFatal(msg) {
  const host = $('#app') || document.body;
  host.append(el('div', { class: 'foot', style: 'color:var(--danger);white-space:pre-wrap', text: 'Ошибка: ' + msg }));
}
window.addEventListener('error', (e) => showFatal(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason?.message || String(e.reason)));

/* ---------- Service Worker ---------- *
 * Только по HTTP: на file:// Service Worker не работает, а в single-file
 * сборке его и вовсе нет. Сама игра от этого не ломается.
 */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service Worker не зарегистрирован:', err.message);
    });
  });
}
