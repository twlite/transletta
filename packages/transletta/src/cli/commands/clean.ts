import type { Transletta } from '../../transletta.js';
import { rm } from 'node:fs/promises';

/**
 * Clean all generated translation files
 */
export async function cleanCommand(transletta: Transletta): Promise<void> {
  const outputDir = transletta.getOutputDirectory();

  try {
    await rm(outputDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, which is fine
  }
}
