import type { CatalogData } from '../../content/content';
import type { StudyTarget } from './types';

export class Catalog {
  readonly roots: StudyTarget[];
  constructor(private data: CatalogData) { this.roots = data.roots(); }
  members(id: string): string[] { return this.data.members(id); }
  clearMetadata() { this.data.clear_metadata(); }
  ingestMetadata(root: StudyTarget, json: string): string[] { return this.data.ingest_metadata(root.id, json); }
  identities(): string[] { return this.data.identities(); }
  sourceName(id: string): string | undefined { return this.data.source_name(id); }
  free() { this.data.free(); }
}
