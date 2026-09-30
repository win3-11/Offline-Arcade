/**
 * Роутинг без циклических импортов.
 *
 * Раньше app.js импортировал игры, а игры импортировали navigate из app.js.
 * Теперь навигация живёт здесь: и бандлеру, и браузеру всё равно, откуда игра
 * получит переход на главный экран — главное, что цикла импортов нет.
 */
import { el } from './utils.js';
import { icon } from './icons.js';

const routes = new Map();   // path -> { title, load?, render? }
let host = null;            // контейнер, куда рисуем экраны
let onLeave = null;         // dispose активной игры
let token = 0;              // защита от гонки при быстрых переходах

/** Текущий маршрут из адресной строки: '#/g2048' → 'g2048'. */
export const getRoute = () => (location.hash.replace(/^#\/?/, '') || 'home');

export function register(path, route) {
  routes.set(path, route);
}

export function mount(node) {
  host = node;
  window.addEventListener('hashchange', render);
  render();
}

/** Переход на экран: меняем hash и рисуем сразу, не дожидаясь события. */
export function navigate(path) {
  if (location.hash === '#/' + path) return render();
  location.hash = '#/' + path;
  return render();
}

async function render() {
  const mine = ++token;
  if (onLeave) { onLeave(); onLeave = null; }

  const path = getRoute();
  const route = routes.get(path) || routes.get('home');
  if (!host || !route) return;

  // На file:// меняем hash через location.replace — иначе Chromium показывает
  // предупреждение «Небезопасная перезагрузка сайта».
  if (location.protocol === 'file:') {
    const target = '#/' + path;
    if (location.hash !== target) {
      try { history.replaceState(null, '', target); }
      catch { /* некоторые браузеры на file:// это блокируют — тогда просто меняем */ }
    }
  }

  const view = el('div', { class: 'view' });
  const shell = () => el('div', { class: 'app' }, topbar(route.title), view);

  // Сразу рисуем каркас — экран не остаётся пустым, пока грузится модуль игры
  host.replaceChildren(shell());

  if (!route.load) {
    view.append(route.render());
  } else {
    view.append(el('div', { class: 'foot', text: 'Загрузка…' }));
    try {
      const mod = await route.load();
      if (mine !== token) return;            // пока грузили, ушли на другой экран
      view.replaceChildren();
      const res = route.render(mod);
      // Игра возвращает { node, dispose } — dispose вызовется при уходе
      if (res && typeof res === 'object' && res.node) {
        onLeave = res.dispose || null;
        view.append(res.node);
      } else {
        view.append(res);
      }
    } catch (err) {
      if (mine !== token) return;
      console.error('Не удалось открыть игру', path, err);
      view.replaceChildren(el('p', { class: 'foot', text: 'Не удалось открыть игру «' + route.title + '»: ' + err.message }));
    }
  }

  if (mine !== token) return;
  host.replaceChildren(shell());
  window.scrollTo(0, 0);
}

/**
 * Шапка приложения. Кнопки темы и звука вставляет app.js через
 * слоты .theme-slot / .sound-slot — у него есть доступ к настройкам.
 */
function topbar(title) {
  return el('div', { class: 'topbar' },
    el('button', {
      class: 'icon-btn', title: 'На главную', 'aria-label': 'На главную',
      html: icon('home'), onclick: () => navigate('home'),
    }),
    el('div', { class: 'brand' },
      el('div', { class: 'logo', html: icon('grid', 22) }),
      el('div', {}, title, el('small', { text: 'работает без интернета' })),
    ),
    el('div', { class: 'spacer' }),
    el('div', { class: 'sound-slot' }),
    el('div', { class: 'theme-slot' }),
  );
}
