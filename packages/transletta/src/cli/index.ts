import { Transletta } from '../transletta.js';
import { Command } from 'commander';

export async function bootstrapCLI(argv?: string[]): Promise<void> {
  const { loadConfig } = await import('../config/load-config.js');
  const { version } = await import('../version.js');
  const config = await loadConfig(process.cwd());
  const transletta = new Transletta(config);

  const program = new Command();
  program.version(version);
  program.description('Elegant i18n build system for humans');

  const build = async () => {
    const translations = await transletta.compile();
    await transletta.emit(translations);
  };

  program.command('build').description('Compile the translations').alias('b').action(build);

  program
    .command('check')
    .description('Check the translations integrity')
    .action(async () => {
      try {
        await transletta.compile();
        process.exitCode = 0;
      } catch (error) {
        process.exitCode = 1;
        console.error(error instanceof Error ? error.message : `${error}`);
      }
    });

  program.action(build);

  if (argv) {
    program.parse(argv, { from: 'user' });
  } else {
    program.parse();
  }
}
