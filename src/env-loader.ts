// @technomoron/env-loader
// A customizable environment configuration validator that generates documentation
// and validates environment variables

import fs from 'fs';
import path from 'path';

export interface envVars {
	[key: string]: string | undefined;
}

interface envOption {
	description: string;
	options?: string[];
	default?: string | number;
	required?: boolean;
	type?: 'string' | 'number' | 'boolean' | 'strings'; // Default 'string'
}

interface envValidatorConfig {
	searchPaths?: string[];
	fileNames?: string[];
	outputPath?: string;
	cascade?: boolean;
}

class envValidator {
	private envOptions: Record<string, envOption> = {}; // Removed readonly
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
	generateTemplate(outputPath: string = this.config.outputPath || './.env-dist'): void {
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

	// Validate environment variables
	validate(env: envVars = this.loadEnvFile() || {}): Record<string, string | number | boolean | string[]> {
		const validatedEnv: Record<string, string | number | boolean | string[]> = {};
		const errors: string[] = [];

		Object.entries(this.envOptions).forEach(([key, option]) => {
			const val = env[key];

			if (option.required && !val) {
				errors.push(`Missing required environment variable: ${key}`);
				return;
			}

			if (!val && option.default !== undefined) {
				validatedEnv[key] = option.default;
				return;
			}

			if (option.options && val && !option.options.includes(val)) {
				errors.push(`Invalid value for ${key}: ${val}. Must be one of: ${option.options.join(', ')}`);
				return;
			}

			validatedEnv[key] = this.parseValue(val || '', option.type); // Provide a default value
		});

		if (errors.length > 0) {
			throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
		}

		return validatedEnv;
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

export default envValidator;
