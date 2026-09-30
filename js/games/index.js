/**
 * Реестр игр для главного экрана.
 * id совпадает с ключем роутера в js/app.js.
 */
export const GAMES = [
  {
    id: 'g2048',
    title: '2048',
    short: '2048',
    desc: 'Соединяй плитки одинаковой величины и доберись до 2048.',
    gradient: 'linear-gradient(140deg,#4f6cf0,#37b57f)',
  },
  {
    id: 'snake',
    title: 'Змейка',
    short: '🐍',
    desc: 'Собирай еду, не врезайся в стены и в свой хвост. Скорость растёт.',
    gradient: 'linear-gradient(140deg,#37b57f,#e2b93b)',
  },
  {
    id: 'mines',
    title: 'Сапер',
    short: '💣',
    desc: 'Три уровня сложности, первый клик всегда безопасный, таймер и флажки.',
    gradient: 'linear-gradient(140deg,#2b3550,#e0264a)',
  },
  {
    id: 'tetris',
    title: 'Тетрис',
    short: '🧱',
    desc: 'Классические фигуры, стакан, превью следующей, пауза и сброс.',
    gradient: 'linear-gradient(140deg,#8b5cf6,#4d8bff)',
  },
];
