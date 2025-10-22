import type { Transletta } from '../../transletta.js';

/**
 * Build command - compile and emit translations
 */
export async function buildCommand(transletta: Transletta): Promise<void> {
  const resource = await transletta.compile();
  await transletta.emit(resource);
  console.log('✅ Successfully compiled and emitted translations');
}
