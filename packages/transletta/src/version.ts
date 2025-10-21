function getVersion(): string {
  'use macro';
  return require('../package.json').version;
}

export const version: string = getVersion();
