import type { Collection } from '../common/collection.js';

/**
 * A manager that supports caching.
 */
export interface CacheableManager<K, V> {
  /**
   * The cache of the manager.
   */
  readonly cache: Collection<K, V>;
}
