import { readFile } from 'node:fs/promises';
import * as toml from 'smol-toml';
import type { TranslationManager } from '../managers/translation-manager.js';
import { DYNAMIC_CONTENT_REGEX, REFERENCES_KEY } from '../common/constants.js';
import { TranslettaSerializationError } from '../common/errors/transletta-serialization-error.js';

/**
 * The options for a translation.
 */
export interface TranslationOptions {
  /**
   * The raw content of the translation file.
   */
  content: string;
  /**
   * The locale of the translation.
   */
  locale: string;
  /**
   * The name of the translation.
   */
  name: string;
  /**
   * The path to the translation file.
   */
  path: string;
}

export interface TranslationMetadata {
  /**
   * The name of the translation.
   */
  name: string;
  /**
   * The locale of the translation.
   */
  locale: string;
  /**
   * The path to the translation file.
   */
  path: string;
}

/**
 * The serialized representation of a translation.
 */
export interface SerializedTranslation {
  metadata: TranslationMetadata;
  content: Record<string, any>;
}

/**
 * Represents a translation.
 */
export class Translation {
  /**
   * The name of this translation.
   */
  public readonly name: string;
  /**
   * The locale of this translation.
   */
  public readonly locale: string;
  /**
   * The data of this translation.
   */
  public data: toml.TomlTable;
  /**
   * The path to this translation file.
   */
  public readonly path: string;

  /**
   * Create a new translation.
   * @param options The options for the translation.
   */
  public constructor(
    public readonly manager: TranslationManager,
    options: TranslationOptions,
  ) {
    this.name = options.name;
    this.locale = options.locale;
    this.data = toml.parse(options.content);
    this.path = options.path;
  }

  /**
   * Get the value of a key in this translation.
   * @param key The key to get the value of.
   * @returns The value of the key.
   */
  public get<T = unknown>(key: string): T {
    if (key.includes('.')) {
      const [parsedName, paths] = this.parseNeighborName(key);
      let entry = this.data[parsedName];

      paths.forEach((path) => {
        const val = (entry as Record<string, any>)?.[path];

        if (val === undefined) {
          throw new TranslettaSerializationError(
            this,
            `Path ${path} not found`,
            `The path ${path} of ${this.name} is not found`,
          );
        }

        entry = val;
      });

      return entry as T;
    }

    return this.data[key] as T;
  }

  /**
   * Reload this translation
   */
  public async reload() {
    const content = await readFile(this.path, 'utf-8');
    this.data = toml.parse(content);
  }

  public getMetadata(): TranslationMetadata {
    return {
      name: this.name,
      locale: this.locale,
      path: this.path,
    };
  }

  private parseNeighborName(name: string): [string, string[]] {
    const parsed = name.replace(/^@/, '').split('.');

    if (parsed.length) {
      return [parsed.shift()!, parsed];
    }

    return [name, []];
  }

  /**
   * Get a neighbor translation by name.
   * @param name The name of the neighbor translation.
   * @returns The neighbor translation or null if not found.
   */
  public getNeighbor(name: string): Translation | null {
    const [parsedName] = this.parseNeighborName(name);
    if (parsedName === this.name) {
      throw new TranslettaSerializationError(
        this,
        `Reference ${name} is self-referencing`,
        `The reference ${name} of ${this.name} is referencing itself`,
      );
    }

    const store = this.manager.cache.get(this.locale);
    if (!store) return null;

    const result = store.get(parsedName);

    return result ?? null;
  }

  /**
   * Serialize this translation to raw JSON content.
   */
  public serialize(): SerializedTranslation {
    // TODO: traverse the data and connect references to other translations and generate a plain JSON object
    const content: Record<string, any> = {};
    const references: Record<string, Translation> = {};
    const { references: referencesMap, ...data } = this.data;

    for (const [key, value] of Object.entries(referencesMap ?? {})) {
      const neighbor = this.getNeighbor(value);
      if (!neighbor) {
        throw new TranslettaSerializationError(
          this,
          `Reference ${value} not found`,
          `The reference ${value} of ${this.name} is not found`,
        );
      }

      references[key] = neighbor;
    }

    this.traverse(data, (key, value) => {
      if (typeof value !== 'string') return;

      const matches = value.match(DYNAMIC_CONTENT_REGEX);
      if (!matches) return;

      for (const match of matches) {
        const [, key] = match.match(/^@?([a-zA-Z0-9._-]+)/)!;
        const neighbor = this.getNeighbor(key!);
        if (!neighbor) {
          throw new TranslettaSerializationError(
            this,
            `Reference ${key} not found`,
            `The reference ${key} of ${this.name} is not found`,
          );
        }

        value = value.replace(match, neighbor.get(key!));
      }

      content[key] = value.replace(DYNAMIC_CONTENT_REGEX, (match: string) => {
        const matches = match.match(/^@?([a-zA-Z0-9._-]+)/)!;
        const neighbor = this.getNeighbor(key!);
        if (!neighbor) {
          throw new TranslettaSerializationError(
            this,
            `Reference ${key} not found`,
            `The reference ${key} of ${this.name} is not found`,
          );
        }
        return neighbor.get(key!);
      });
    });

    return {
      metadata: this.getMetadata(),
      content,
    };
  }

  private traverse(data: Record<string, any>, callback: (key: string, value: any) => void) {
    if (data === null || data === undefined) return;

    for (const [key, value] of Object.entries(data)) {
      callback(key, value);
      if (typeof value === 'object' && value !== null) {
        this.traverse(value, callback);
      }
    }
  }
}

/*
{
  name: 'en/common',
  data: { buttons: { 'sign-up': 'Sign Up', login: 'Login' } }
}
{
  name: 'en/home',
  data: {
    references: { buttons: '@common.buttons' },
    hero: {
      title: 'Hello World',
      description: 'This is a description of the hero section',
      cta: { 'sign-up': '{@buttons.sign-up}', login: '{@buttons.login}' }
    }
  }
}
*/
