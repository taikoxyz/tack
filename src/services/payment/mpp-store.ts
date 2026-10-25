import type Database from 'better-sqlite3';
import { Store } from 'mppx/server';

/**
 * Persistent store for mppx's Tempo charge replay protection.
 *
 * mppx records every settled (or attempted) transaction hash under
 * `mppx:charge:<hash>` and rejects a credential whose hash it has seen.
 * Its default store is a process-local `Map`, which forgets everything on
 * restart or deploy, so previously used hashes would be accepted again.
 * This store keeps them in the same SQLite database as the rest of Tack's
 * state.
 *
 * `put` is insert-only on purpose. mppx checks a hash and records it in two
 * separate steps with on-chain verification in between (hash credentials),
 * so two concurrent requests carrying the same hash can both pass the
 * check. With an insert-only `put`, exactly one of them records the hash
 * and the other fails with the same "already used" error as the check.
 * mppx writes each key once per payment, so this never rejects a legitimate
 * first use.
 */
export const MPP_HASH_ALREADY_USED_MESSAGE = 'Transaction hash has already been used.';

interface SeenHashRow {
  value: string;
}

export function createSqliteMppStore(db: Database.Database): Store.Store {
  const selectStmt = db.prepare('SELECT value FROM mppx_seen_hashes WHERE key = ?');
  const insertStmt = db.prepare(
    'INSERT INTO mppx_seen_hashes (key, value, created) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING'
  );
  const deleteStmt = db.prepare('DELETE FROM mppx_seen_hashes WHERE key = ?');

  // better-sqlite3 is synchronous; the Store interface is async, so each method returns a settled promise.
  return Store.from({
    get(key) {
      const row = selectStmt.get(key) as SeenHashRow | undefined;
      if (row === undefined) return Promise.resolve(null as never);
      return Promise.resolve(JSON.parse(row.value) as never);
    },
    put(key, value) {
      try {
        // `changes` is 0 when the key already exists: the hash was used before (or a concurrent request just won).
        const { changes } = insertStmt.run(key, JSON.stringify(value), new Date().toISOString());
        if (changes === 0) {
          return Promise.reject(new Error(MPP_HASH_ALREADY_USED_MESSAGE));
        }
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
      return Promise.resolve();
    },
    delete(key) {
      deleteStmt.run(key);
      return Promise.resolve();
    },
  });
}
