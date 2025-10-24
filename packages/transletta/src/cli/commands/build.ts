import type { Transletta } from '../../transletta.js';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Build command - compile and emit translations
 */
export async function buildCommand(transletta: Transletta, watchMode = false): Promise<void> {
  const performBuild = async () => {
    try {
      const resource = await transletta.compile();
      await transletta.emit(resource);
      console.log('✅ Successfully compiled and emitted translations');
    } catch (error) {
      console.error('❌ Build failed:', error instanceof Error ? error.message : error);
    }
  };

  // Perform initial build
  await performBuild();

  if (!watchMode) {
    return;
  }

  console.log('👀 Watching for file changes...');

  const inputDir = transletta.getInputDirectory();

  if (!existsSync(inputDir)) {
    console.error(`❌ Input directory does not exist: ${inputDir}`);
    return;
  }

  // Debounce function to prevent excessive rebuilds
  let rebuildTimeout: NodeJS.Timeout | null = null;
  const debouncedRebuild = () => {
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout);
    }
    rebuildTimeout = setTimeout(() => {
      console.log('🔄 File change detected, rebuilding...');
      performBuild();
    }, 300); // 300ms debounce
  };

  // Watch the input directory recursively
  const watcher = watch(inputDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    // Only watch .toml files
    if (!filename.endsWith('.toml')) return;

    // Ignore files in output directory
    const fullPath = join(inputDir, filename);
    if (fullPath.includes(transletta.getOutputDirectory())) return;

    debouncedRebuild();
  });

  // Handle process termination
  const cleanup = () => {
    watcher.close();
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout);
    }
    console.log('\n👋 Stopped watching for changes');
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
