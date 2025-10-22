import type { Transletta } from '../../transletta.js';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, stringify } from 'smol-toml';

/**
 * Sync all locales with the primary locale schema
 */
export async function syncCommand(transletta: Transletta): Promise<void> {
  const inputDir = transletta.getInputDirectory();
  const primaryLocale = transletta.config.primaryLocale;

  // Check if primary locale exists
  const primaryLocaleDir = join(inputDir, primaryLocale);
  try {
    await readdir(primaryLocaleDir);
  } catch (error) {
    throw new Error(`Primary locale directory not found: ${primaryLocaleDir}`);
  }

  // Get all locale directories, excluding output directory
  const contents = await readdir(inputDir, { withFileTypes: true });
  const outputDirName =
    transletta.config.output.split('/').pop() || transletta.config.output.split('\\').pop() || 'generated';
  const localeDirs = contents
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !entry.name.startsWith('_') &&
        entry.name !== outputDirName,
    )
    .map((entry) => entry.name);

  // Sync each locale with primary locale
  for (const locale of localeDirs) {
    if (locale === primaryLocale) continue;

    const localeDir = join(inputDir, locale);

    // Get primary locale files
    const primaryFiles = await readdir(primaryLocaleDir);
    const tomlFiles = primaryFiles.filter((file) => file.endsWith('.toml'));

    // Get current locale files
    let currentFiles: string[] = [];
    try {
      currentFiles = await readdir(localeDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await mkdir(localeDir, { recursive: true });
    }

    // Remove extra files
    for (const file of currentFiles) {
      if (file.endsWith('.toml') && !tomlFiles.includes(file)) {
        const filePath = join(localeDir, file);
        await rm(filePath);
        console.log(`🗑️  Removed extra file: ${locale}/${file}`);
      }
    }

    // Smart merge for each file
    for (const file of tomlFiles) {
      const sourcePath = join(primaryLocaleDir, file);
      const targetPath = join(localeDir, file);

      const primaryContent = await readFile(sourcePath, 'utf-8');
      const primaryData = parse(primaryContent);

      let targetData: any = {};

      // Read existing target file if it exists
      if (currentFiles.includes(file)) {
        try {
          const targetContent = await readFile(targetPath, 'utf-8');
          targetData = parse(targetContent);
        } catch (error) {
          // File exists but couldn't be parsed, treat as empty
          targetData = {};
        }
      }

      // Merge the data structures
      const mergedData = mergeTranslationData(primaryData, targetData);

      // Convert back to TOML format using smol-toml stringify
      const mergedContent = stringify(mergedData);

      await writeFile(targetPath, mergedContent, 'utf-8');

      if (!currentFiles.includes(file)) {
        console.log(`📄 Created file: ${locale}/${file}`);
      } else {
        console.log(`🔄 Synced file: ${locale}/${file}`);
      }
    }
  }
}

/**
 * Merge translation data, preserving existing translations while adding missing keys
 */
function mergeTranslationData(primaryData: any, targetData: any): any {
  // Recursively merge objects
  function mergeObjects(primary: any, target: any): any {
    const merged: any = { ...target };

    for (const [key, value] of Object.entries(primary)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // If it's an object, recursively merge
        if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
          merged[key] = mergeObjects(value, target[key]);
        } else {
          // Target doesn't have this object, add it with primary values
          merged[key] = { ...value };
        }
      } else {
        // If it's a primitive value, only add if target doesn't have it
        if (!(key in target)) {
          merged[key] = value;
        }
        // If target has it, keep the target value (preserve existing translations)
      }
    }

    return merged;
  }

  return mergeObjects(primaryData, targetData);
}
