/**
 * Слой хранения: рекорды, настройки и состояние игр.
 * Всё в localStorage — работает офлайн и синхронно.
 */

const NS = 'offline-arcade:';
const K = {
  scores: NS + 'scores',        // { gameId: { best, bestAt } }
  settings: NS + 'settings',    // { theme, sound }
  states: NS + 'states',        // { gameId: сериализованное состояние }
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим / переполнение — просто игнорируем */
  }
}

/* ---------- Рекорды ---------- */
export const scores = {
  all() {
    return read(K.scores, {});
  },
  best(gameId) {
    return this.all()[gameId]?.best ?? 0;
  },
  /** Сохраняет и возвращает true, если побит прежний рекорд. */
  submit(gameId, value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
    const data = this.all();
    const prev = data[gameId]?.best ?? 0;
    if (value <= prev) return false;
    data[gameId] = { best: value, bestAt: Date.now() };
    write(K.scores, data);
    return true;
  },
  reset(gameId) {
    const data = this.all();
    delete data[gameId];
    write(K.scores, data);
  },
};

/* ---------- Настройки ---------- */
const DEFAULT_SETTINGS = { theme: 'dark', sound: false };

export const settings = {
  get() {
    return { ...DEFAULT_SETTINGS, ...read(K.settings, {}) };
  },
  set(patch) {
    const next = { ...this.get(), ...patch };
    write(K.settings, next);
    return next;
  },
};

/* ---------- Состояние игр (автосохранение) ---------- */
export const saveState = {
  load(gameId) {
    return read(K.states, {})[gameId] ?? null;
  },
  save(gameId, state) {
    const all = read(K.states, {});
    all[gameId] = state;
    write(K.states, state ? all : { ...all, [gameId]: null });
  },
  clear(gameId) {
    const all = read(K.states, {});
    delete all[gameId];
    write(K.states, all);
  },
};
