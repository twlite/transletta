# Transletta Core

The core transletta package provides the translation processing engine, CLI tools, and TypeScript APIs for building internationalized applications.

## Installation

```bash
bun add -D transletta
```

## Usage

### CLI

```bash
# Build translations
transletta build

# Create new locale
transletta create --locale fr

# Watch mode
transletta build --watch
```

### Programmatic API

```typescript
import { Transletta } from 'transletta';

const transletta = new Transletta({
  input: '.transletta',
  output: '.transletta/generated',
  primaryLocale: 'en',
});

await transletta.compile();
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
});
```

## Translation Files

### Basic Structure

```toml
# .transletta/en/common.toml
title = 'Welcome'
description = 'This is a description'

[buttons]
sign-up = 'Sign Up'
login = 'Login'
```

### Reference System

```toml
# .transletta/en/home.toml
[references]
buttons = '@common.buttons'

[hero]
title = 'Hello World'
description = 'This is a description'

[hero.cta]
sign-up = '{@buttons.sign-up}'
login = '{@buttons.login}'
welcome = 'Welcome {@hero.title}'
desc = 'Description: {@hero.description}'
```

### Workspace References

```toml
# .transletta/en/shared.toml
[references]
ui = '@@web.ui'

[content]
button = '{@ui.button}'
```

### Lookup Order

Transletta follows a specific lookup order for `{@key}` references:

1. **References Block**: First checks if the key is declared in the `[references]` block
2. **Local Keys**: If not found in references, looks for the key in the current translation file

This allows you to use `{@key}` syntax to reference both external translations and local content seamlessly.

## API Reference

### Transletta Class

```typescript
class Transletta {
  constructor(config: TranslettaConfig);

  async compile(): Promise<CompilationResult>;
  getInputDirectory(): string;
  getOutputDirectory(): string;
  dispose(): void;
}
```

### Translation Class

```typescript
class Translation {
  readonly name: string;
  readonly locale: string;
  readonly path: string;

  get<T>(key: string): T;
  serialize(): SerializedTranslation;
  getNeighbor(name: string): Translation | null;
}
```

### Configuration Interface

```typescript
interface TranslettaConfig {
  input: string;
  output: string;
  primaryLocale: string;
  projects: Record<string, string> | null;
  plugins: Array<never>;
}
```

## Error Handling

Transletta provides comprehensive error handling with detailed messages:

- **Circular Reference Detection**: Shows the complete cycle path
- **Missing References**: Specifies the exact reference and context
- **Invalid Syntax**: Validates TOML structure and reference format
- **Key Not Found**: Reports missing keys with full path information

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

## TypeScript Support

Full TypeScript support with:

- Type-safe configuration
- IntelliSense for translation keys
- Compile-time error checking
- Generated type definitions

## Performance

- Zero runtime overhead
- Compile-time processing
- Optimized JSON output
- Incremental builds with watch mode
