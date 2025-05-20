// @technomoron/env-loader
// A customizable environment configuration validator that generates documentation
// and validates environment variables

import fs from 'fs';
import path from 'path';

export interface envVars {
	[key: string]: string | undefined;
}

export interface envOption {
	description: string;
	options?: string[];
	default?: string | number | boolean | string[];
	required?: boolean;
	type?: 'string' | 'number' | 'boolean' | 'strings'; // Default is 'string'
	name?: string; // Custom property name for the resulting config
}

export interface envValidatorConfig {
	searchPaths?: string[];
	fileNames?: string[];
	outputPath?: string;
	cascade?: boolean;
}

// Utility Type: Infers the TypeScript type for envConfig based on envOptions
type EnvOptionType<T extends envOption> = T['type'] extends 'number'
	? number
	: T['type'] extends 'boolean'
		? boolean
		: T['type'] extends 'strings'
			? string[]
			: string; // Default to string if not explicitly set

export type envConfig<T extends Record<string, envOption>> = {
	[K in keyof T as T[K]['name'] extends string ? T[K]['name'] : K]: T[K]['required'] extends true
		? EnvOptionType<T[K]> // Required variables are mandatory
		: EnvOptionType<T[K]> | undefined; // Optional variables may be undefined
};

export class envValidator {
	private envOptions: Record<string, envOption> = {};
	private readonly config: envValidatorConfig;

	constructor(options?: envValidatorConfig) {
		this.config = {
			searchPaths: ['./', '../', '../../'],
			fileNames: ['.env'],
			outputPath: './.env-dist',
			cascade: false,
			...options,
		};
	}

	// Define environment variables and their validation rules
	define(envOptions: Record<string, envOption>): this {
		this.envOptions = envOptions;
		return this;
	}

	// Generate a .env-dist file with documentation
	writeConfig(outputPath: string = this.config.outputPath || './.env-dist'): void {
		const lines = Object.entries(this.envOptions).map(([key, option]) => {
			const opt = `${option.type || 'string'}${option.required ? ' - required' : ''}`;
			const result = [`# ${option.description} [${opt}]`];

			if (option.options) {
				result.push(`# Possible values: ${option.options.join(', ')}`);
			}

			const value = option.required ? `${key}=` : `# ${key}=${option.default || ''}`;
			result.push(value, '');
			return result.join('\n');
		});

		fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
		console.log(`.env-dist file has been created at ${outputPath}`);
	}

	validate<T extends Record<string, envOption>>(
		env: envVars = this.loadEnvFile() || {},
		envOptions: T
	): envConfig<T> {
		const validatedEnv = {} as Partial<envConfig<T>>; // Initialize as Partial<envConfig<T>>
		const errors: string[] = [];

		// Normalize keys for case-insensitive matching
		const normalizedEnv: Record<string, string | undefined> = {};
		for (const [key, value] of Object.entries(env)) {
			normalizedEnv[normalizeKey(key)] = value;
		}

		Object.entries(envOptions).forEach(([key, option]) => {
			const normalizedKey = normalizeKey(key);
			const targetKey = (option.name || key) as keyof envConfig<T>; // Use `name` or original key

			// Attempt to find the value in `env` using case-insensitive matching
			const val = normalizedEnv[normalizedKey] !== undefined ? normalizedEnv[normalizedKey] : env[key]; // Fallback to the original key

			// Handle required variables
			if (option.required && !val) {
				errors.push(`Missing required environment variable: ${key}`);
				return;
			}

			// Handle default values
			if (!val && option.default !== undefined) {
				validatedEnv[targetKey] = option.default as unknown as envConfig<T>[typeof targetKey];
				return;
			}

			// Handle allowed options
			if (option.options && val && !option.options.includes(val)) {
				errors.push(`Invalid value for ${key}: ${val}. Must be one of: ${option.options.join(', ')}`);
				return;
			}

			// Parse and assign the value to the correct key (custom name or default)
			validatedEnv[targetKey] = this.parseValue(
				val || '',
				option.type || 'string'
			) as unknown as envConfig<T>[typeof targetKey];
		});

		if (errors.length > 0) {
			throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
		}

		// Safely cast validatedEnv to envConfig<T> after validation
		return validatedEnv as unknown as envConfig<T>;
	}
	private parseValue(
		value: string,
		type: 'string' | 'number' | 'boolean' | 'strings' = 'string'
	): string | number | boolean | string[] {
		switch (type) {
			case 'boolean':
				return this.parseBoolean(value);
			case 'number':
				const numValue = Number(value);
				if (isNaN(numValue)) throw new Error(`Invalid number: ${value}`);
				return numValue;
			case 'strings':
				return value.split(',').map((str) => str.trim());
			default:
				return value;
		}
	}

	private parseBoolean(value: string): boolean {
		const truthy = new Set(['true', '1', 'yes', 'on']);
		const falsy = new Set(['false', '0', 'no', 'off']);
		return truthy.has(value.toLowerCase()) ? true : falsy.has(value.toLowerCase()) ? false : Boolean(value);
	}

	private parseEnvFile(filePath: string): envVars {
		const content = fs.readFileSync(filePath, 'utf8');
		return content.split('\n').reduce<envVars>((env, line) => {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) return env;

			const [, key, value] = trimmed.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/) || [];
			if (key) env[key] = value?.replace(/^['"]|['"]$/g, '').trim();
			return env;
		}, {});
	}

	private loadEnvFile(): envVars | null {
		const baseDir = process.cwd();
		const paths = (this.config.searchPaths || ['./']).flatMap((searchPath) =>
			(this.config.fileNames || ['.env']).map((fileName) => path.join(baseDir, searchPath, fileName))
		);

		const existingFiles = paths.filter(fs.existsSync);

		if (!this.config.cascade) {
			return existingFiles.length > 0 ? this.parseEnvFile(existingFiles[0]) : null;
		}

		return existingFiles.reduce<envVars>((mergedEnv, filePath) => {
			const parsedEnv = this.parseEnvFile(filePath);
			return { ...mergedEnv, ...parsedEnv };
		}, {});
	}
}

// Utility: Normalize keys for case-insensitive matching
function normalizeKey(key: string): string {
	return key.toLowerCase().replace(/_/g, '');
}

export default envValidator;
