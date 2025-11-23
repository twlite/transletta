import type { Transletta } from '../../transletta.js';
import type { CompiledTranslations } from '../managers/translation-manager.js';
import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

let _require: NodeJS.Require;

const CLIENT_MODULE_NAME = 'index.js';
const CLIENT_DTS_NAME = 'index.d.ts';
const CLIENT_PACKAGE_NAME = 'transletta/client';

/**
 * The client generator.
 */
export class ClientGenerator {
  /**
   * Generate the client module and DTS file.
   * @param resource The compiled translations.
   * @param transletta The Transletta instance.
   */
  public async generate(resource: CompiledTranslations, transletta: Transletta): Promise<void> {
    const clientContent = this.getClientContent(resource, transletta);
    const clientDtsContent = this.getClientDtsContent(resource, transletta);

    const clientFilePath = path.join(this.resolvePackagePath(), CLIENT_MODULE_NAME);
    const clientDtsFilePath = path.join(this.resolvePackagePath(), CLIENT_DTS_NAME);

    await this.emitFile(clientFilePath, clientContent);
    await this.emitFile(clientDtsFilePath, clientDtsContent);
  }

  /**
   * Emit a file to the file system.
   * @param filePath The path to the file.
   * @param content The content of the file.
   */
  private async emitFile(filePath: string, content: string) {
    const dir = path.dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true }).catch(() => {});
    }

    await writeFile(filePath, content);
  }

  /**
   * Get the content of the client DTS file.
   * @param resource The compiled translations.
   * @param transletta The Transletta instance.
   */
  private getClientDtsContent(resource: CompiledTranslations, transletta: Transletta) {
    let dts = `// Auto-generated Transletta client DTS module\n`;

    dts += `export type Locales = ${resource
      .toKeyArray()
      .map((locale) => `'${locale}'`)
      .join(' | ')};\n\n`;

    dts += `export const AvailableLocales = [${resource
      .toKeyArray()
      .map((locale) => `'${locale}'`)
      .join(', ')}] as const;\n\n`;

    dts += `export const DefaultLocale = '${transletta.config.primaryLocale}' as const;\n\n`;

    dts += `export const isValidLocale = (locale: string): locale is Locales => AvailableLocales.includes(locale as Locales);\n\n`;

    return dts;
  }

  /**
   * Get the content of the client module.
   * @param resource The compiled translations.
   * @param transletta The Transletta instance.
   */
  private getClientContent(resource: CompiledTranslations, transletta: Transletta) {
    let client = `// Auto-generated Transletta client module\n`;

    client += `export const AvailableLocales = [${resource
      .toKeyArray()
      .map((locale) => `'${locale}'`)
      .join(', ')}];\n\n`;

    client += `export const DefaultLocale = '${transletta.config.primaryLocale}';\n\n`;

    client += `export const isValidLocale = (locale) => AvailableLocales.includes(locale);\n\n`;

    return client;
  }

  /**
   * Resolve the path to the client package.
   */
  private resolvePackagePath() {
    if (!_require) {
      _require = createRequire(import.meta.url);
    }

    const targetPackage = _require.resolve(CLIENT_PACKAGE_NAME);
    const targetLocation = path.dirname(targetPackage);

    return targetLocation;
  }
}
