import type { Transletta } from '../../transletta.js';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Create a new locale by copying files from the primary locale
 */
export async function createCommand(transletta: Transletta, locale: string): Promise<void> {
  const inputDir = transletta.getInputDirectory();
  const primaryLocale = transletta.config.primaryLocale;

  // Check if primary locale exists
  const primaryLocaleDir = join(inputDir, primaryLocale);
  try {
    await readdir(primaryLocaleDir);
  } catch (error) {
    throw new Error(`Primary locale directory not found: ${primaryLocaleDir}`);
  }

  // Check if target locale already exists
  const targetLocaleDir = join(inputDir, locale);
  try {
    const files = await readdir(targetLocaleDir);
    if (files.length > 0) {
      throw new Error(`Locale already exists: ${locale}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
    // Directory doesn't exist, which is what we want
  }

  // Create target locale directory
  await mkdir(targetLocaleDir, { recursive: true });

  // Copy all TOML files from primary locale to target locale
  const files = await readdir(primaryLocaleDir);
  for (const file of files) {
    if (file.endsWith('.toml')) {
      const sourcePath = join(primaryLocaleDir, file);
      const targetPath = join(targetLocaleDir, file);

      const content = await readFile(sourcePath, 'utf-8');
      await writeFile(targetPath, content, 'utf-8');
    }
  }
}
