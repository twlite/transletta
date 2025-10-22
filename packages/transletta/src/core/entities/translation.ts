import { readFile } from 'node:fs/promises';
import * as toml from 'smol-toml';
import type { TranslationManager } from '../managers/translation-manager.js';
import { EMBEDDING_REGEX, PARAMETER_REGEX, REFERENCES_KEY } from '../common/constants.js';
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
  parameters: string[];
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
   * Get a workspace translation by project name and translation name.
   * @param projectName The name of the project.
   * @param translationName The name of the translation.
   * @returns The workspace translation or null if not found.
   */
  public getWorkspaceTranslation(projectName: string, translationName: string): Translation | null {
    const projects = this.manager.transletta.config.projects;
    if (!projects || !projects[projectName]) {
      return null;
    }

    // For now, we'll need to implement workspace scanning
    // This is a placeholder for the workspace reference functionality
    return null;
  }

  /**
   * Serialize this translation to raw JSON content.
   */
  public serialize(): SerializedTranslation {
    return this.serializeWithContext(new Set());
  }

  /**
   * Serialize this translation with circular reference detection.
   * @param visited Set of visited translation paths to detect circular references.
   */
  private serializeWithContext(visited: Set<string>): SerializedTranslation {
    const content: Record<string, any> = {};
    const parameters: string[] = [];
    const { references: referencesMap, ...data } = this.data;

    // Check for circular reference
    const currentPath = `${this.locale}/${this.name}`;
    if (visited.has(currentPath)) {
      const cycle = Array.from(visited).concat([currentPath]);
      throw new TranslettaSerializationError(
        this,
        `Circular reference detected: ${cycle.join(' → ')}`,
        `Circular reference detected in translation chain: ${cycle.join(' → ')}`,
      );
    }

    // Add current translation to visited set
    const newVisited = new Set(visited);
    newVisited.add(currentPath);

    // Validate and resolve references
    const resolvedReferences: Record<string, { translation: Translation; keyPath: string }> = {};
    for (const [alias, reference] of Object.entries(referencesMap ?? {})) {
      let translation: Translation | null = null;
      let keyPath = '';

      if (reference.startsWith('@@')) {
        // Workspace reference: @@projectName or @@projectName.keyPath
        const rest = reference.slice(2);
        const dotIndex = rest.indexOf('.');
        const projectName = dotIndex > -1 ? rest.slice(0, dotIndex) : rest;
        keyPath = dotIndex > -1 ? rest.slice(dotIndex + 1) : '';
        translation = this.getWorkspaceTranslation(projectName, alias);
      } else if (reference.startsWith('@')) {
        // Local reference: @translationName or @translationName.keyPath
        const rest = reference.slice(1);
        const dotIndex = rest.indexOf('.');
        const translationName = dotIndex > -1 ? rest.slice(0, dotIndex) : rest;
        keyPath = dotIndex > -1 ? rest.slice(dotIndex + 1) : '';
        translation = this.getNeighbor(translationName);
      } else {
        throw new TranslettaSerializationError(
          this,
          `Invalid reference format: ${reference}`,
          `Reference ${reference} must start with @ or @@`,
        );
      }

      if (!translation) {
        throw new TranslettaSerializationError(
          this,
          `Reference ${reference} not found`,
          `The reference ${reference} of ${this.name} is not found`,
        );
      }

      resolvedReferences[alias] = { translation, keyPath };
    }

    // Process the data and resolve embeddings
    this.traverse(data, (key, value) => {
      if (typeof value !== 'string') return;

      // Extract parameters (e.g., {name})
      const parameterMatches = value.match(PARAMETER_REGEX);
      if (parameterMatches) {
        for (const match of parameterMatches) {
          const paramName = match.slice(1, -1).trim();
          if (!parameters.includes(paramName)) {
            parameters.push(paramName);
          }
        }
      }

      // Resolve embeddings (e.g., {@alias.key} or {@key})
      const embeddingMatches = value.match(EMBEDDING_REGEX);
      if (embeddingMatches) {
        for (const match of embeddingMatches) {
          // Reset regex and use exec to get captured groups
          EMBEDDING_REGEX.lastIndex = 0;
          const execResult = EMBEDDING_REGEX.exec(match);
          if (!execResult || !execResult[1]) continue;

          const fullPath = execResult[1]; // e.g., "buttons.sign-up" or "title"
          const dotIndex = fullPath.indexOf('.');
          const alias = dotIndex > -1 ? fullPath.slice(0, dotIndex) : fullPath;
          const keyPath = dotIndex > -1 ? fullPath.slice(dotIndex + 1) : '';

          let resolvedValue: any;

          // Lookup order: references -> local
          if (resolvedReferences[alias]) {
            // Reference exists in [references] block
            const { translation, keyPath: referenceKeyPath } = resolvedReferences[alias];
            const fullKeyPath = referenceKeyPath ? `${referenceKeyPath}.${keyPath}` : keyPath;

            // Check if the referenced translation has embeddings that might cause circular references
            resolvedValue = translation.get(fullKeyPath);

            // If the resolved value is a string with embeddings, resolve them with circular reference detection
            if (typeof resolvedValue === 'string' && resolvedValue.includes('{@')) {
              // Create a temporary translation to resolve embeddings in the referenced value
              const tempTranslation = new Translation(this.manager, {
                content: `temp = '${resolvedValue}'`,
                locale: translation.locale,
                name: `${translation.name}.temp`,
                path: translation.path,
              });
              const tempSerialized = tempTranslation.serializeWithContext(newVisited);
              resolvedValue = tempSerialized.content.temp;
            }

            if (resolvedValue === undefined) {
              throw new TranslettaSerializationError(
                this,
                `Key ${fullKeyPath} not found in ${alias}`,
                `The key ${fullKeyPath} is not found in the referenced translation ${alias}`,
              );
            }
          } else {
            // Try local lookup - check if the key exists in the current translation
            const localKey = fullPath; // Use the full path for local lookup
            resolvedValue = this.get(localKey);

            if (resolvedValue === undefined) {
              throw new TranslettaSerializationError(
                this,
                `Key ${localKey} not found locally or in references`,
                `The key ${localKey} is not found in the current translation or declared in the [references] block`,
              );
            }
          }

          value = value.replace(match, resolvedValue);
        }
      }

      content[key] = value;

      // Warn about empty translation strings if enabled in config
      if (typeof value === 'string' && value.trim() === '' && this.manager.transletta.config.warnOnEmptyTranslations) {
        console.warn(`⚠️  Empty translation found: ${this.locale}/${this.name} → ${key}`);
      }
    });

    return {
      metadata: this.getMetadata(),
      content,
      parameters,
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
