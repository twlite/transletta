import { defineConfig as defineTsupConfig, type Options } from 'tsup';
import { esbuildPluginUseMacro } from 'use-macro';

const BANNER = `// Copyright (c) ${new Date().getFullYear()} Twilight. All rights reserved.
// Licensed under the MIT License.`;

export function defineConfig(config: Options = {}) {
  const { esbuildPlugins = [], ...rest } = config;

  return defineTsupConfig({
    format: 'esm',
    skipNodeModulesBundle: true,
    bundle: false,
    sourcemap: true,
    target: 'es2022',
    clean: true,
    removeNodeProtocol: false,
    outDir: 'dist',
    dts: true,
    banner: {
      js: BANNER,
    },
    platform: 'node',
    ...rest,
    esbuildPlugins: [...esbuildPlugins, esbuildPluginUseMacro()],
  });
}
