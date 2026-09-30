 /**
  * Иконки в стиле Lucide (MIT), встроенные инлайн-SVG:
  * без внешних зависимостей, работают офлайн.
  *
  * Использование:
  *   icon('grid')   → строка разметки, только для свойства { html: ... }
  *   iconEl('grid') → готовый SVG-узел, для дочерних элементов el(...)
  */
 export const PATHS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  play: '<path d="m5 3 14 9-14 9V3Z"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.7V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2.3"/><path d="M6 4h12v5a6 6 0 0 1-12 0Z"/>',
  wifiOff: '<path d="m2 2 20 20"/><path d="M8.5 8.5A10 10 0 0 1 21 9"/><path d="M5 12.5A10 10 0 0 1 10 10"/><path d="M2 8.8A15 15 0 0 1 6.7 6"/><path d="M12 20h.01"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
};

/**
 * Иконка как готовый SVG-узел — для передачи в el(...) как дочерний элемент.
 * Строковый вариант icon() годится только для свойства `html`.
 * @param {keyof typeof PATHS} name
 */
export function iconEl(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name] || '';
  return svg;
}

/** @param {keyof typeof PATHS} name */
export function icon(name, size = 20) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
}
