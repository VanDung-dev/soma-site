import auto from '../assets/icons/line-md/star-alt.svg?raw';
import light from '../assets/icons/line-md/sunny.svg?raw';
import dark from '../assets/icons/line-md/moon-alt.svg?raw';
import right from '../assets/icons/line-md/arrow-small-right.svg?raw';
import windows from '../assets/icons/bootstrap/windows.svg?raw';
import apple from '../assets/icons/bootstrap/apple.svg?raw';

export const icons = { auto, light, dark, right, windows, apple };

export function icon(name: keyof typeof icons): string {
  return `<span class="line-md-icon" aria-hidden="true">${icons[name]}</span>`;
}
