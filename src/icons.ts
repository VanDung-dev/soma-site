import auto from './icons/line-md/star-alt.svg?raw';
import light from './icons/line-md/sunny.svg?raw';
import dark from './icons/line-md/moon-alt.svg?raw';
import right from './icons/line-md/arrow-small-right.svg?raw';

export const icons = { auto, light, dark, right };

export function icon(name: keyof typeof icons): string {
  return `<span class="line-md-icon" aria-hidden="true">${icons[name]}</span>`;
}
