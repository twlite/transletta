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

  // Build command
  program
    .command('build')
    .description('Compile the translations')
    .alias('b')
    .action(async () => {
      try {
        const { buildCommand } = await import('./commands/build.js');
        await buildCommand(transletta);
      } catch (error) {
        process.exitCode = 1;
        console.error(error instanceof Error ? error.message : `${error}`);
      }
    });

  // Check command
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

  // Create command
  program
    .command('create')
    .description('Create a new locale by copying from the primary locale')
    .option('-l, --locale <locale>', 'Locale code to create (e.g., fr, es, de)')
    .action(async (options) => {
      if (!options.locale) {
        console.error('❌ Error: --locale option is required');
        process.exitCode = 1;
        return;
      }

      try {
        const { createCommand } = await import('./commands/create.js');
        await createCommand(transletta, options.locale);
        console.log(`✅ Successfully created locale: ${options.locale}`);
      } catch (error) {
        console.error(`❌ Error creating locale: ${error instanceof Error ? error.message : error}`);
        process.exitCode = 1;
      }
    });

  // Clean command
  program
    .command('clean')
    .description('Remove all generated translation files')
    .action(async () => {
      try {
        const { cleanCommand } = await import('./commands/clean.js');
        await cleanCommand(transletta);
        console.log('🧹 Successfully cleaned generated files');
      } catch (error) {
        console.error(`❌ Error cleaning files: ${error instanceof Error ? error.message : error}`);
        process.exitCode = 1;
      }
    });

  // Sync command
  program
    .command('sync')
    .description('Sync all locales with the primary locale schema')
    .action(async () => {
      try {
        const { syncCommand } = await import('./commands/sync.js');
        await syncCommand(transletta);
        console.log('🔄 Successfully synced all locales with primary locale');
      } catch (error) {
        console.error(`❌ Error syncing locales: ${error instanceof Error ? error.message : error}`);
        process.exitCode = 1;
      }
    });

  // Default action (build)
  program.action(async () => {
    try {
      const { buildCommand } = await import('./commands/build.js');
      await buildCommand(transletta);
    } catch (error) {
      process.exitCode = 1;
      console.error(error instanceof Error ? error.message : `${error}`);
    }
  });

  if (argv) {
    program.parse(argv, { from: 'user' });
  } else {
    program.parse();
  }
}
