import { Transletta } from '../transletta';

export async function bootstrapCLI(argv: string[]): Promise<void> {
  const { loadConfig } = await import('../config/load-config');

  const config = await loadConfig(process.cwd());

  const transletta = new Transletta(config);
}
