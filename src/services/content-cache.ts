export interface CachedGatewayContent {
  cid: string;
  content: ArrayBuffer;
  contentType: string;
  filename: string | null;
  size: number;
}

export class GatewayContentCache {
  private readonly entries = new Map<string, CachedGatewayContent>();
  private totalSizeBytes = 0;

  constructor(private readonly maxSizeBytes: number) {}

  get(cid: string): CachedGatewayContent | null {
    const entry = this.entries.get(cid);
    if (!entry) {
      return null;
    }

    // Refresh recency.
    this.entries.delete(cid);
    this.entries.set(cid, entry);
    return entry;
  }

  set(entry: CachedGatewayContent): void {
    if (this.maxSizeBytes <= 0 || entry.size > this.maxSizeBytes) {
      return;
    }

    const existing = this.entries.get(entry.cid);
    if (existing) {
      this.totalSizeBytes -= existing.size;
      this.entries.delete(entry.cid);
    }

    this.entries.set(entry.cid, entry);
    this.totalSizeBytes += entry.size;
    this.evictIfNeeded();
  }

  delete(cid: string): void {
    const existing = this.entries.get(cid);
    if (!existing) {
      return;
    }

    this.entries.delete(cid);
    this.totalSizeBytes -= existing.size;
  }

  private evictIfNeeded(): void {
    while (this.totalSizeBytes > this.maxSizeBytes && this.entries.size > 0) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) {
        return;
      }

      const oldest = this.entries.get(oldestKey);
      if (!oldest) {
        return;
      }

      this.entries.delete(oldestKey);
      this.totalSizeBytes -= oldest.size;
    }
  }
}
