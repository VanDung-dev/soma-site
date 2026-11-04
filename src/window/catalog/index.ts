import type { CatalogData } from '../../generated/content/content';
import type { StudyTarget } from './types';

export class Catalog {
  readonly roots: StudyTarget[];
  constructor(private data: CatalogData) { this.roots = data.roots(); }
  ingestMetadata(root: StudyTarget, json: string): string[] { return this.data.ingest_metadata(root.id, json); }
  identities(): string[] { return this.data.identities(); }
  sourceName(id: string): string | undefined { return this.data.source_name(id); }
  free() { this.data.free(); }
}
