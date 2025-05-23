# @technomoron/env-loader

A robust, minimal-dependency utility for loading, validating, and parsing environment variables with `.env` file support, strong type inference, and advanced validation powered by [Zod](https://zod.dev/) or custom transforms.

## Features

- **Minimal dependencies:** Only Zod is required for advanced validation.
- **Type-safe:** Full TypeScript type inference from your schema.
- **Zod validation:** Native support for Zod schemas and custom transforms.
- **Flexible parsing:** Supports `string`, `number`, `boolean`, `strings` (comma lists), enums, and custom logic.
- **Layered config:** Optionally cascade/override with multiple `.env` files.
- **Duplicate detection:** Detects duplicate keys (case-insensitive) within a single `.env` file and warns if `debug: true`.
- **Strict mode:** Optional proxy that throws on unknown config keys.
- **Configurable:** Debug logging, custom search paths and filenames, and more.
- **Template generation:** Auto-generate a commented `.env` template from your schema.

## Installation

```
npm install @technomoron/env-loader
# or
yarn add @technomoron/env-loader
# or
pnpm add @technomoron/env-loader
```

## Quick Example

```
import EnvLoader, { defineEnvOptions, envConfig } from '@technomoron/env-loader';
import { z } from 'zod';

// Define your schema using defineEnvOptions for best type inference
const envOptions = defineEnvOptions({
  NODE_ENV: {
    description: 'Runtime environment',
    options: ['development', 'production', 'test'],
    default: 'development',
  },
  PORT: {
    description: 'Server port',
    type: 'number',
    default: 3000,
  },
  DATABASE_URL: {
    description: 'Database connection string',
    required: true,
  },
  FEATURE_FLAGS: {
    description: 'Comma-separated features',
    type: 'strings',
    default: ['logging', 'metrics'],
  },
  ENABLE_EMAIL: {
    description: 'Enable email service',
    type: 'boolean',
    default: false,
  },
  LOG_LEVEL: {
    description: 'Log verbosity',
    options: ['error', 'warn', 'info', 'debug'],
    default: 'info',
  },
  CUSTOM: {
    description: 'Custom value validated by Zod',
    zodSchema: z.string().regex(/^foo-.+/),
    default: 'foo-bar',
  },
});

// Type-safe config for VSCode/IDE
const config = EnvLoader.createConfig(envOptions);

// Now use your config!
console.log(`Running in ${config.NODE_ENV} mode on port ${config.PORT}`);
console.log(`Features: ${config.FEATURE_FLAGS.join(', ')}`);
console.log(`Email enabled? ${config.ENABLE_EMAIL}`);
console.log(`Custom value: ${config.CUSTOM}`);
```

---

## API

### `defineEnvOptions(options)`

Helper for TypeScript type inference. Pass your env schema as an object.

### Environment Option Properties

- `description` (string): What this variable is for.
- `type` (`string` | `number` | `boolean` | `strings`): Parsing mode.
- `required` (boolean): Whether it must be present.
- `options` (array): Valid values (enum-like).
- `default`: Fallback if not set. (Type matches `type`)
- `transform` (function): Custom parser, `(raw: string) => any`.
- `zodSchema` (ZodType): Full validation/transformation via [Zod](https://zod.dev/).

### `EnvLoader.createConfig(envOptions, options?)`

Loads, parses, and validates environment using your schema.

- `envOptions`: Your schema (from `defineEnvOptions`).
- `options`: Loader options (see below).

Returns: **Typed config object** where all keys are the inferred types.

### `EnvLoader.createConfigProxy(envOptions, options?)`

Same as `createConfig`, but returned config **throws on unknown keys** (useful for strict/safer code).

### `EnvLoader.genTemplate(schema, file)`

Generate a commented `.env` template file (with descriptions and default/example values) for your schema.

```
EnvLoader.genTemplate(envOptions, '.env.example');
```

---

## Loader Options

Pass as second argument to `createConfig`, `createConfigProxy`, or in the constructor:

- `searchPaths` (string[]): Folders to search for `.env` files. Default: `['./']`
- `fileNames` (string[]): Filenames to load. Default: `['.env']`
- `cascade` (boolean): If true, merge all found files (last wins). Default: `false`
- `debug` (boolean): Print debug output and duplicate key warnings. Default: `false`
- `envFallback` (boolean): Fallback to `process.env` if not found in files. Default: `true`

---

## Parsing & Validation

### Supported Types

- **string:** Default if `type` is omitted.
- **number:** Parsed using `Number()`.
- **boolean:** Accepts `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off` (case-insensitive).
- **strings:** Comma-separated list → string array.

### Enum/Options

Use `options: [...]` to enforce one of several allowed values.

### Zod Schemas

Use `zodSchema` for advanced parsing/validation:

```
import { z } from 'zod';

const schema = defineEnvOptions({
  SECRET: {
    description: 'Must start with foo-',
    zodSchema: z.string().startsWith('foo-'),
    required: true,
  },
});
```

### Custom Transform

Use `transform: (raw) => parsed` for custom logic:

```
const schema = defineEnvOptions({
  PORT: {
    description: 'Server port',
    transform: (v) => parseInt(v) + 1000, // e.g., offset
    default: '3000',
  },
});
```

---

## Error Handling & Debugging

- **Missing required keys:**

    ```
    Missing from config: DATABASE_URL,API_KEY
    ```

- **Type errors:**

    ```
    'PORT' must be a number
    'ENABLE_EMAIL' must be a boolean
    ```

- **Zod schema failures:**

    ```
    'CUSTOM' zod says it bad: Invalid input
    ```

- **Invalid options:**

    ```
    Invalid 'LOG_LEVEL': silly
    ```

- **Duplicate keys in .env (with debug enabled):**
    ```
    Duplicate keys in .env: FOO (lines 1 and 3), bar (lines 5 and 8)
    ```

All validation errors are thrown as a single error message (one per line).

---

## Layered Configuration Example

Load multiple `.env` files (e.g. for local overrides or per-environment):

```
const config = EnvLoader.createConfig(envOptions, {
  searchPaths: ['./'],
  fileNames: ['.env', '.env.local', `.env.${process.env.NODE_ENV}`],
  cascade: true,
});
```

Load order:

1. `.env` (base)
2. `.env.local` (overrides)
3. `.env.production` (if `NODE_ENV=production`)

---

## Advanced: Strict Proxy Mode

For extra safety, use the proxy:

```
const config = EnvLoader.createConfigProxy(envOptions);

console.log(config.PORT);      // ok
console.log(config.UNKNOWN);   // throws Error!
```

---

## Example `.env` files

**.env**

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost/db
FEATURE_FLAGS=logging,metrics
ENABLE_EMAIL=false
```

**.env.local**

```
DATABASE_URL=postgresql://dev:password@localhost/devdb
ENABLE_EMAIL=true
```

**.env.production**

```
NODE_ENV=production
PORT=8080
LOG_LEVEL=warn
```

---

## Migration Notes

- API is static/class-based (`EnvLoader.createConfig`, not instance `.define/.validate`).
- Supports advanced parsing with Zod or custom transforms.
- Built-in `.env` template/documentation generator: `EnvLoader.genTemplate(...)`.
- Duplicate keys in a single `.env` file are detected and warned about in debug mode.

---

## License

MIT - Copyright (c) 2025 Bjørn Erik Jacobsen / Technomoron
