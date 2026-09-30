/**
 * Мелкие утилиты: DOM-хелперы, свайпы, короткий звук на WebAudio.
 */

/** Создание элемента: el('div', {class:'x', onclick:fn}, child, 'text') */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    // Строка с разметкой станет ТЕКСТОМ, а не элементом — предупреждаем.
    // Для SVG используй iconEl() из icons.js.
    if (typeof c === 'string' && c.trimStart().startsWith('<')) {
      console.warn('el(): строка с разметкой вставлена как текст. Используй { html } или iconEl().');
    }
    node.append(c?.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/**
 * Вешает распознавание свайпов на элемент.
 * @param {HTMLElement} node
 * @param {(dx:number, dy:number)=>boolean} onSwipe — вернуть true, если жест обработан
 * @param {number} threshold — минимальная длина жеста, px
 */
export function onSwipe(node, onSwipe, threshold = 28) {
  let sx = 0, sy = 0, tracking = false;

  node.addEventListener('pointerdown', (e) => {
    // Правый клик мышью — это не начало свайпа
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sx = e.clientX; sy = e.clientY; tracking = true;
  });

  node.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < threshold) return;
    tracking = false;
    onSwipe(dx, dy);
    sx = e.clientX; sy = e.clientY;
  });

  const stop = () => { tracking = false; };
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointercancel', stop);
}

/**
 * Короткий «бип» на WebAudio — без внешних файлов, работает офлайн.
 * Ничего не делает, если звук выключен или AudioContext заблокирован.
 */
export function beep(freq = 440, ms = 70, type = 'square', gain = 0.04) {
  let enabled = false;
  try { enabled = JSON.parse(localStorage.getItem('offline-arcade:settings') || '{}').sound; } catch { /* ignore */ }
  if (!enabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (beep.ctx ||= new AC());
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.value = gain;
    osc.connect(vol).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* ignore */
  }
}

/** Клавиатура: вызов onKey по key, без срабатывания в полях ввода. */
export function onKey(handler) {
  const fn = (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    handler(e);
  };
  window.addEventListener('keydown', fn);
  return () => window.removeEventListener('keydown', fn);
}
