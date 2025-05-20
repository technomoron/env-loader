# @technomoron/env-loader

A standalone, configurable utility for validating environment variables with built-in documentation generation. This tool helps manage configuration across various environments by providing type checking, default values, and layered configuration capabilities.

## Key Benefits

- **Dependency-Free**: Implemented without external libraries
- **Self-Documenting**: Creates .env templates with detailed annotations
- **Type Safety**: Verifies variable types (string, number, boolean, string arrays)
- **Sensible Defaults**: Define fallback values for optional configuration
- **Layered Configuration**: Combine multiple .env files with precedence rules
- **Mandatory Fields**: Designate essential configuration parameters
- **Environment Agnostic**: Compatible with Node.js and browser contexts

## Installation

```bash
npm install @technomoron/env-loader
```

or with Yarn:

```bash
yarn add @technomoron/env-loader
```

## Basic Example

```typescript
import envValidator from '@technomoron/env-loader';

// Configure your environment schema
const env = new envValidator().define({
	NODE_ENV: {
		description: 'Runtime environment setting',
		options: ['development', 'production', 'test'],
		default: 'development',
	},
	PORT: {
		description: 'Server listening port',
		type: 'number',
		default: 3000,
	},
	DATABASE_URL: {
		description: 'Database connection string',
		required: true,
	},
	FEATURE_FLAGS: {
		description: 'Active feature toggles',
		type: 'strings',
		default: 'logging,metrics',
	},
});

// Create documentation template
env.generateTemplate();

// Process and validate environment configuration
const config = env.validate();

// Utilize the validated configuration
console.log(`Server starting on port ${config.PORT} in ${config.NODE_ENV} mode`);
console.log(`Active features: ${config.FEATURE_FLAGS.join(', ')}`);
```

## Configuration Details

### Variable Definition

Use the `define` method to specify environment variables and their properties:

```typescript
env.define({
	CONFIG_PARAM: {
		description: 'Parameter description', // For documentation
		type: 'string', // Data type (string|number|boolean|strings)
		required: true, // Is this parameter mandatory?
		options: ['value1', 'value2'], // Permitted values
		default: 'default-value', // Fallback if not specified
	},
});
```

### Definition Options

- **description**: Explains the variable's purpose (used in documentation)
- **type**: Value type (`string`, `number`, `boolean`, or `strings` for comma-delimited lists)
- **required**: Indicates if the variable must be present (`true`/`false`)
- **options**: Array of valid values for validation
- **default**: Fallback value when not explicitly set

### Documentation Generation

Create a template file with inline documentation:

```typescript
// Generate at default location (./.env-dist)
env.generateTemplate();

// Or specify custom location
env.generateTemplate('./config/.env.template');
```

The generated template includes helpful comments:

```env
# Runtime environment setting [string]
# Possible values: development, production, test
# NODE_ENV=development

# Server listening port [number]
# PORT=3000

# Database connection string [string - required]
DATABASE_URL=

# Active feature toggles [strings]
# FEATURE_FLAGS=logging,metrics
```

### Environment Validation

Process and validate environment variables:

```typescript
// Validate using auto-loaded .env files
const config = env.validate();

// Or validate specific environment object
const config = env.validate({
	NODE_ENV: 'production',
	PORT: '8080',
	DATABASE_URL: 'postgresql://user:pass@localhost/db',
});
```

### Multi-Level Configuration

Enable layered configuration by loading multiple files with override capability:

```typescript
const env = new envValidator({
	searchPaths: ['./'],
	fileNames: ['.env', '.env.local', `.env.${process.env.NODE_ENV}`],
	cascade: true,
});
```

This configuration will:

1. Start with `.env` as baseline configuration
2. Apply overrides from `.env.local` if present
3. Finally apply environment-specific settings from the current NODE_ENV

This pattern supports:

- Common settings in `.env`
- Developer-specific overrides in `.env.local` (typically gitignored)
- Environment-specific configurations in `.env.development`, `.env.production`, etc.

## Advanced Options

### Initialization Parameters

```typescript
const env = new envValidator({
	// Directory paths to search for configuration files (relative to CWD)
	searchPaths: ['./', '../', '../../'],

	// Configuration filenames to locate
	fileNames: ['.env', '.env.local', '.env.development'],

	// Target path for template generation
	outputPath: './config/.env.template',

	// Enable multi-file loading with override support
	cascade: true,
});
```

### Boolean Value Processing

Boolean values are intelligently parsed from multiple formats:

- **Truthy values**: `'true'`, `'1'`, `'yes'`, `'on'`
- **Falsy values**: `'false'`, `'0'`, `'no'`, `'off'`

### Array Value Handling

Variables with type `'strings'` are parsed from comma-separated text:

```
CORS_ORIGINS=http://localhost:3000,https://example.com,https://api.example.com
```

This becomes the array:

```javascript
['http://localhost:3000', 'https://example.com', 'https://api.example.com'];
```

## Comprehensive Example

```typescript
import envValidator from '@technomoron/env-loader';

// Initialize with configuration options
const env = new envValidator({
	searchPaths: ['./'],
	fileNames: ['.env', '.env.local', `.env.${process.env.NODE_ENV || 'development'}`],
	outputPath: './.env.template',
	cascade: true,
});

// Define environment configuration schema
env.define({
	// Server settings
	NODE_ENV: {
		description: 'Runtime environment',
		options: ['development', 'production', 'test'],
		default: 'development',
	},
	PORT: {
		description: 'HTTP server port',
		type: 'number',
		default: 3000,
	},
	HOST: {
		description: 'Server binding address',
		default: '0.0.0.0',
	},

	// Database configuration
	DATABASE_URL: {
		description: 'Database connection URI',
		required: true,
	},

	// Authentication settings
	JWT_SECRET: {
		description: 'JWT signing key',
		required: true,
	},
	JWT_EXPIRES_IN: {
		description: 'Token validity period',
		default: '7d',
	},

	// Feature toggles
	FEATURES: {
		description: 'Enabled functionality',
		type: 'strings',
		default: 'logging,metrics',
	},

	// Logging configuration
	LOG_LEVEL: {
		description: 'Logging verbosity',
		options: ['error', 'warn', 'info', 'debug'],
		default: 'info',
	},

	// Email settings
	SMTP_HOST: {
		description: 'Mail server hostname',
	},
	SMTP_PORT: {
		description: 'Mail server port',
		type: 'number',
		default: 587,
	},
	SMTP_SECURE: {
		description: 'Enable TLS for mail',
		type: 'boolean',
		default: true,
	},
});

// Generate documentation template
env.generateTemplate();

// Validate environment and obtain typed configuration
try {
	const config = env.validate();
	console.log('Environment validation successful');

	// Launch application with validated configuration
	startApplication(config);
} catch (error) {
	console.error('Environment validation failed:', error.message);
	process.exit(1);
}

function startApplication(config) {
	console.log(`Server starting on ${config.HOST}:${config.PORT} in ${config.NODE_ENV} mode`);
	console.log(`Enabled features: ${config.FEATURES.join(', ')}`);
	// Application initialization logic...
}
```

## Configuration File Examples

Here's a recommended structure for layered configuration:

**`.env`** (base settings, version controlled):

```
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
```

**`.env.local`** (developer-specific overrides, not committed):

```
DATABASE_URL=postgresql://dev:password@localhost/myapp
JWT_SECRET=dev-environment-key
```

**`.env.production`** (production settings, created during deployment):

```
NODE_ENV=production
PORT=8080
LOG_LEVEL=warn
```

## License

MIT - Copyright (c) 2025 Bjørn Erik Jacobsen
