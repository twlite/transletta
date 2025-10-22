import { relative, dirname } from 'node:path';

/**
 * Generate a relative path from a JSON file to a DTS file.
 * @param jsonPath - The path to the JSON file.
 * @param dtsPath - The path to the DTS file.
 * @returns The relative path.
 * @example
 * // jsonPAth = .transletta/generated/en.json
 * // dtsPath = ./global.d.ts
 * // returns ./.transletta/generated/en.json
 */
export function generateRelativePath(jsonPath: string, dtsPath: string) {
  const dtsDir = dirname(dtsPath);
  const relativePath = relative(dtsDir, jsonPath).replace(/\\/g, '/');
  const relativeStart = relativePath.startsWith('./') || relativePath.startsWith('../');
  const result = relativeStart ? relativePath : `./${relativePath}`;

  return result;
}
