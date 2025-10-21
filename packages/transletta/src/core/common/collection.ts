/**
 * Arbitrary key-value collection.
 */
export class Collection<K = any, V = any> extends Map<K, V> {
  /**
   * Ensure a value is set in the collection.
   * @param key The key to ensure.
   * @param value The value to ensure, or a function to create the value.
   * @returns The value that was set.
   */
  public upsert(key: K, value: V | (() => V)): V {
    if (!this.has(key)) {
      this.set(key, typeof value === 'function' ? (value as () => V)() : value);
    }

    return this.get(key)!;
  }

  /**
   * Find the first value that satisfies the predicate.
   * @param predicate The predicate to satisfy.
   * @returns The value that satisfies the predicate.
   */
  public find(predicate: (value: V, key: K) => boolean): V | undefined {
    for (const [key, value] of this.entries()) {
      if (predicate(value, key)) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Filter the collection by the predicate.
   * @param predicate The predicate to filter by.
   * @returns A new collection with the filtered values.
   */
  public filter(predicate: (value: V, key: K) => boolean): Collection<K, V> {
    const collection = new Collection<K, V>();

    for (const [key, value] of this.entries()) {
      if (predicate(value, key)) {
        collection.set(key, value);
      }
    }

    return collection;
  }

  /**
   * Map the collection to a new array.
   * @param callback The callback to map by.
   * @returns A new array with the mapped values.
   */
  public map<T>(callback: (value: V, key: K) => T): T[] {
    return Array.from(this.entries()).map(([key, value]) => callback(value, key));
  }

  /**
   * Check if some value satisfies the predicate.
   * @param predicate The predicate to check.
   * @returns True if some value satisfies the predicate, false otherwise.
   */
  public some(predicate: (value: V, key: K) => boolean): boolean {
    for (const [key, value] of this.entries()) {
      if (predicate(value, key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if every value satisfies the predicate.
   * @param predicate The predicate to check.
   * @returns True if every value satisfies the predicate, false otherwise.
   */
  public every(predicate: (value: V, key: K) => boolean): boolean {
    for (const [key, value] of this.entries()) {
      if (!predicate(value, key)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Reduce the collection to a single value.
   * @param callback The callback to reduce by.
   * @param initialValue The initial value.
   * @returns The reduced value.
   */
  public reduce<T>(callback: (accumulator: T, value: V, key: K) => T, initialValue: T): T {
    let accumulator = initialValue;

    for (const [key, value] of this.entries()) {
      accumulator = callback(accumulator, value, key);
    }

    return accumulator;
  }

  /**
   * Convert the collection to an array.
   * @returns An array of key-value pairs.
   */
  public toArray(): Array<[K, V]> {
    return Array.from(this.entries());
  }

  /**
   * Convert the collection to an array of values.
   * @returns An array of values.
   */
  public toValueArray(): V[] {
    return Array.from(this.values());
  }

  /**
   * Convert the collection to an array of keys.
   * @returns An array of keys.
   */
  public toKeyArray(): K[] {
    return Array.from(this.keys());
  }

  /**
   * Convert the collection to a JSON array.
   * @returns A JSON array of key-value pairs.
   */
  public toJSON(): Array<[K, V]> {
    return this.toArray();
  }
}
