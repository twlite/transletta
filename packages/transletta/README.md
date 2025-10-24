# Transletta

A TypeScript-based internationalization (i18n) build system that transforms human-readable TOML translation files into optimized JSON output for applications and monorepos.

> [!IMPORTANT]
> This project is in its early stage. Expect bugs!

## Overview

Transletta provides a powerful reference system to eliminate translation duplication and maintain consistency across your application. It processes TOML files at build time and generates clean JSON output with zero runtime overhead.

## Key Features

- **Reference System**: Link translations across files using `{@alias.key}` syntax
- **Monorepo Support**: Share translations across projects with workspace references
- **Parameter Extraction**: Identify and validate `{name}` style parameters
- **Circular Reference Detection**: Prevent infinite loops in reference chains
- **TypeScript Integration**: Built with TypeScript for type safety and excellent developer experience
- **Zero Runtime**: Compile-time translation processing with no runtime overhead
- **Watch Mode**: Automatic rebuilding when translation files change
- **Framework Integration**: Built-in support for Next.js and Vite

## Installation

```bash
# Install transletta in your project
bun add -D transletta

# Or use the CLI globally
bun add -g transletta
```

## Quick Start

### 1. Create Translation Files

```toml
# .transletta/en/common.toml
[buttons]
sign-up = 'Sign Up'
login = 'Login'

# .transletta/en/home.toml
[references]
buttons = '@common.buttons'

[hero]
title = 'Welcome to our app'
description = 'This is a description'

[hero.cta]
sign-up = '{@buttons.sign-up}'
login = '{@buttons.login}'
welcome = 'Welcome {@hero.title}'
desc = 'Description: {@hero.description}'
```

### 2. Configure Transletta

```typescript
// transletta.config.ts
import { defineConfig } from 'transletta/config';

export default defineConfig({
  input: '.transletta',
  output: '.transletta/generated',
  primaryLocale: 'en',
});
```

### 3. Build Translations

```bash
# One-time build
bun run transletta

# Watch mode for development
bun run transletta build --watch
```

## Reference System

Transletta's reference system allows you to share translations across files while maintaining clear relationships.

### Local References

Reference other translation files within the same locale:

```toml
[references]
shared = '@common.shared'

[content]
title = '{@shared.title}'
```

### Local Key References

Reference keys within the same file:

```toml
[hero]
title = 'Welcome'
description = 'Description'

[hero.cta]
welcome = 'Welcome {@hero.title}'
desc = 'Description: {@hero.description}'
```

### Workspace References (Monorepo)

Reference translations from other projects in a monorepo:

```toml
[references]
ui = '@@web.ui'

[content]
button = '{@ui.button}'
```

### Lookup Order

Transletta follows a specific lookup order for `{@key}` references:

1. **References Block**: First checks if the key is declared in the `[references]` block
2. **Local Keys**: If not found in references, looks for the key in the current translation file

## CLI Commands

### Build Translations

```bash
# Build once
transletta build

# Watch for changes
transletta build --watch
transletta build -w
```

### Create New Locale

```bash
transletta create --locale fr
```

### Check Translation Integrity

```bash
transletta check
```

### Sync Locales

```bash
transletta sync
```

### Clean Generated Files

```bash
transletta clean
```

## Configuration

Create a `transletta.config.ts` file in your project root:

```typescript
import { defineConfig } from 'transletta/config';

export default defineConfig({
  input: '.transletta', // Input directory for TOML files
  output: '.transletta/generated', // Output directory for JSON files
  primaryLocale: 'en', // Primary locale
  projects: {
    // Monorepo project mappings
    web: 'apps/web',
    api: 'apps/api',
  },
  warnOnEmptyTranslations: true, // Show warnings for empty strings
  dts: true, // Generate TypeScript definitions
  dtsOutput: './types/translations.d.ts', // Custom DTS output path
  compactOutput: true, // Single JSON file per locale
});
```

### Configuration Options

- `input`: Directory containing TOML translation files (default: `.transletta`)
- `output`: Directory for generated JSON files (default: `.transletta/generated`)
- `primaryLocale`: Primary locale used for schema validation (default: `en`)
- `projects`: Monorepo project mappings for workspace references
- `warnOnEmptyTranslations`: Show warnings for empty translation strings
- `dts`: Generate TypeScript definitions (`true`, `false`, `'i18next'`, `'next-intl'`)
- `dtsOutput`: Custom path for TypeScript definition files
- `compactOutput`: Generate single JSON file per locale vs. separate files

## Framework Integration

### Next.js Plugin

Integrate Transletta with your Next.js application:

```typescript
// next.config.ts
import { createTransletta } from 'transletta/next';

const withTransletta = createTransletta({
  compileOnBuild: true,
  watchInDevelopment: true,
});

const nextConfig = {
  // your Next.js config
};

export default withTransletta(nextConfig);
```

#### Next.js Plugin Options

- `config`: Custom Transletta configuration
- `compileOnBuild`: Run compilation during build (default: `true`)
- `watchInDevelopment`: Watch for changes in development (default: `true`)

### Vite Plugin

Integrate Transletta with your Vite application:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { transletta } from 'transletta/vite';

export default defineConfig({
  plugins: [
    transletta({
      compileOnBuild: true,
      watchInDevelopment: true,
      enableHMR: true,
      hmrStrategy: 'targeted', // or 'full'
    }),
  ],
});
```

#### Vite Plugin Options

- `config`: Custom Transletta configuration
- `compileOnBuild`: Run compilation during build (default: `true`)
- `watchInDevelopment`: Watch for changes in development (default: `true`)
- `enableHMR`: Enable Hot Module Replacement (default: `true`)
- `hmrStrategy`: HMR strategy - `'targeted'` for partial updates or `'full'` for full page reload

## Translation File Structure

### Basic Structure

```toml
# .transletta/en/common.toml
title = 'Welcome'
description = 'This is a description'

[buttons]
sign-up = 'Sign Up'
login = 'Login'
```

### Nested Sections

```toml
# .transletta/en/home.toml
[hero]
title = 'Hello World'
description = 'This is a description'

[hero.cta]
sign-up = 'Get Started'
login = 'Sign In'
```

### Parameter Placeholders

```toml
greeting = 'Hello {name}!'
welcome = 'Welcome {firstName} {lastName}'
```

## Error Handling

Transletta provides comprehensive error handling with detailed messages:

- **Circular Reference Detection**: Shows the complete cycle path
- **Missing References**: Specifies the exact reference and context
- **Invalid Syntax**: Validates TOML structure and reference format
- **Key Not Found**: Reports missing keys with full path information
- **Schema Validation**: Ensures all locales match the primary locale structure

## Advanced Features

### Parameter Extraction

Transletta automatically extracts `{name}` style parameters:

```toml
greeting = 'Hello {name}!'
```

Results in:

```json
{
  "greeting": "Hello {name}!",
  "parameters": ["name"]
}
```

### Circular Reference Detection

Prevents infinite loops in reference chains:

```toml
# file1.toml
[references]
other = '@file2'

# file2.toml
[references]
other = '@file1'  # Error: Circular reference detected
```

### Schema Validation

All locales must match the primary locale structure:

```bash
# Primary locale (en)
# .transletta/en/home.toml
title = 'Welcome'

# Secondary locale (fr) - must have same structure
# .transletta/fr/home.toml
title = 'Bienvenue'
```

## TypeScript Support

Full TypeScript support with:

- Type-safe configuration
- IntelliSense for translation keys
- Compile-time error checking
- Generated type definitions for i18next and next-intl

## Performance

- Zero runtime overhead
- Compile-time processing
- Optimized JSON output
- Incremental builds with watch mode
- Debounced file watching (300ms)

## Project Structure

This repository uses a monorepo structure with Turborepo:

```
transletta/
├── packages/
│   ├── transletta/          # Core transletta package
│   ├── ui/                  # Shared UI components
│   ├── eslint-config/       # Shared ESLint configuration
│   └── typescript-config/   # Shared TypeScript configuration
├── apps/
│   └── web/                 # Example web application
└── turbo/                   # Turborepo configuration
```

## Development

### Prerequisites

- Node.js 18+
- Bun (recommended) or npm/yarn

### Setup

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Lint code
bun run lint
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
