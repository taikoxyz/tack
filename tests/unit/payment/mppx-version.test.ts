import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Minimum mppx release containing the upstream fixes to Tempo charge verification.
// Guards against an accidental downgrade through a lockfile or override change.
const MIN_MPPX = [0, 4, 11] as const;

function parse(version: string): number[] {
  return version.split('-')[0].split('.').map((part) => Number.parseInt(part, 10));
}

function atLeast(actual: number[], minimum: readonly number[]): boolean {
  for (let i = 0; i < minimum.length; i += 1) {
    const a = actual[i] ?? 0;
    if (a !== minimum[i]) return a > minimum[i];
  }
  return true;
}

describe('mppx dependency', () => {
  it('resolves to a release with the Tempo charge verification fixes', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'node_modules', 'mppx', 'package.json'), 'utf8'),
    ) as { version: string };

    expect(atLeast(parse(manifest.version), MIN_MPPX)).toBe(true);
  });
});
