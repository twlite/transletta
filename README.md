# Transletta

A modern, TypeScript-based internationalization (i18n) build system that simplifies translation management for applications and monorepos.

> [!IMPORTANT]
> This project is in its early stage. Expect bugs!

## Overview

Transletta transforms human-readable TOML translation files into optimized JSON output, providing a powerful reference system to eliminate duplication and maintain consistency across your translations.

## Key Features

- **Reference System**: Link translations across files using `{@alias.key}` syntax
- **Monorepo Support**: Share translations across projects with workspace references
- **Parameter Extraction**: Identify and validate `{name}` style parameters
- **Circular Reference Detection**: Prevent infinite loops in reference chains
- **TypeScript First**: Built with TypeScript for type safety and excellent developer experience
- **Zero Runtime**: Compile-time translation processing with no runtime overhead

## Quick Start

### Installation

```bash
# Install transletta in your project
bun add -D transletta

# Or use the CLI globally
bun add -g transletta
```

### Basic Setup

1. Create your translation files:

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

2. Configure transletta:

```typescript
// transletta.config.ts
import { defineConfig } from 'transletta/config';

export default defineConfig({
  input: '.transletta',
  output: '.transletta/generated',
  primaryLocale: 'en',
});
```

3. Build your translations:

```bash
bun run transletta
```

## Reference System

Transletta's reference system allows you to share translations across files while maintaining clear relationships:

### Local References

```toml
[references]
shared = '@common.shared'

[content]
title = '{@shared.title}'
```

### Local Key References

```toml
[hero]
title = 'Welcome'
description = 'Description'

[hero.cta]
welcome = 'Welcome {@hero.title}'
desc = 'Description: {@hero.description}'
```

### Workspace References (Monorepo)

```toml
[references]
ui = '@@web.ui'

[content]
button = '{@ui.button}'
```

## CLI Commands

### Build Translations

```bash
transletta build
```

### Create New Locale

```bash
transletta create --locale fr
```

### Watch Mode

```bash
transletta build --watch
```

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
