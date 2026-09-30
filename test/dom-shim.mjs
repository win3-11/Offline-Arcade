/**
 * Минимальный DOM-шим: createElement с живыми слушателями, классами
 * и обходом дерева. Достаточно, чтобы прогонять логику игр в Node.
 */

const store = new Map();

class Node {
  constructor(tag) {
    this.nodeType = 1; // элемент — el() в utils.js проверяет это
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this._classes = new Set();
    this._listeners = new Map();
    this._text = '';
    this.hidden = false;
    this.value = '';
    this.width = 0;
    this.height = 0;
    this.textContent = '';
  }

  /* --- классы --- */
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const self = this;
    return {
      add: (...c) => c.forEach((x) => self._classes.add(x)),
      remove: (...c) => c.forEach((x) => self._classes.delete(x)),
      contains: (c) => self._classes.has(c),
      toggle: (c) => (self._classes.has(c) ? self._classes.delete(c) : self._classes.add(c)),
    };
  }
  hasClass(c) { return this._classes.has(c); }

  /* --- атрибуты --- */
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k] ?? null; }

  /* --- дерево --- */
  append(...nodes) {
    for (const n of nodes.flat()) {
      if (typeof n === 'string') { n = textNode(n); }
      n.parentNode = this;
      this.children.push(n);
    }
  }
  appendChild(n) { this.append(n); return n; }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.children.indexOf(this);
    if (i >= 0) this.parentNode.children.splice(i, 1);
  }

  /* --- события --- */
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const a = this._listeners.get(type) || [];
    const i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  }
  /** Синхронная диспетчеризация: { type, ... } */
  emit(type, ev = {}) {
    const e = {
      type, defaultPrevented: false, target: this, currentTarget: this,
      button: 0, pointerType: 'mouse', clientX: 0, clientY: 0,
      stopPropagation() {}, preventDefault() { this.defaultPrevented = true; },
      ...ev,
    };
    for (const fn of [...(this._listeners.get(type) || [])]) fn(e);
    // Всплытие к родителю (исключая повторный вызов на самом узле)
    if (this.parentNode) {
      const bubble = { ...e, target: this.parentNode, currentTarget: this.parentNode };
      for (const fn of [...(this.parentNode._listeners.get(type) || [])]) fn(bubble);
    }
    return e;
  }

  /* --- текст --- */
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent).join('');
    return this._text;
  }

  getContext() {
    const noop = () => {};
    return { setTransform: noop, clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fillRect: noop, canvas: this };
  }

  /* --- поиск --- */
  walk(fn) {
    for (const c of this.children) { fn(c); c.walk(fn); }
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    // Поддерживаем только селекторы по классам: '.a.b'
    const want = String(sel).split('.').filter(Boolean);
    const out = [];
    this.walk((n) => { if (n instanceof Node && want.every((c) => n._classes.has(c))) out.push(n); });
    return out;
  }
}

const textNode = (t) => {
  const n = new Node('#text');
  n.nodeType = 3;
  n._text = t;
  return n;
};

const root = new Node('body');

const noop = () => {};

globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

globalThis.document = {
  body: root,
  createElement: (t) => new Node(t),
  createElementNS: (ns, t) => new Node(t),   // для SVG-иконок
  createTextNode: textNode,
  querySelector: (s) => (s === '#app' ? (root.app ||= new Node('div')) : root.querySelector(s)),
  querySelectorAll: (s) => (s === '#app' ? (root.app ? [root.app] : []) : root.querySelectorAll(s)),
  addEventListener: noop,
  documentElement: new Node('html'),
  activeElement: { tagName: 'BODY' },
};

/** Окно с перехватом глобальных слушателей (клавиатура). */
export const win = {
  _key: [],
  addEventListener(type, fn) { if (type === 'keydown') win._key.push(fn); },
  removeEventListener(type, fn) { if (type === 'keydown') win._key = win._key.filter((f) => f !== fn); },
  dispatchKey(key) { win._key.forEach((f) => f({ key, code: 'Key', preventDefault: noop })); },
};

globalThis.window = { ...win, devicePixelRatio: 1, getComputedStyle: () => ({ getPropertyValue: () => '#000' }), scrollTo: noop, location: { hash: '', protocol: 'http:' } };
globalThis.getComputedStyle = globalThis.window.getComputedStyle;
globalThis.location = globalThis.window.location;
Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker: undefined }, configurable: true });
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = noop;

export { Node, root, store };
