import type { Catalog } from '../catalog/types';
import type { Presentation, Viewport } from '../viewer/contracts';

export const FRAME: Viewport = [0.03, 0.02, 0.94, 0.96];
export const CLOSING_SPAN = 0.7;

const OMITTED = new Set([
  'Hyoid bone',
  'Thyroid cartilage',
  'Cricoid cartilage',
  'Arytenoid cartilage',
  'Corniculate cartilage',
  'Lateral process of nasal septal cartilage',
  'Nasal septal cartilage',
  'Major alar cartilage',
]);

export function allowedStructures(catalog: Catalog, ids: string[]): string[] {
  return ids.filter(id => !OMITTED.has(catalog.sourceName(id) || ''));
}

export function layoutFor(scene: number): string {
  return scene === 0 ? 'hero' : scene === 1 ? 'right' : scene === 3 ? 'closing' : 'split';
}

export function presentationFor(scene: number, allowed: string[]): Presentation {
  return {
    visible: allowed,
    focus: allowed,
    yaw: scene === 0 ? 1.1 : scene === 3 ? -1.1 : 0,
    spread: scene === 2,
    viewport: FRAME,
  };
}
