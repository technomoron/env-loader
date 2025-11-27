// @technomoron/env-loader
// MIT - Copyright (c) 2025 Bjørn Erik Jacobsen/Technomoron

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ZodError } from 'zod';

import type { ZodTypeAny } from 'zod';

interface envVars {
	[key: string]: string | undefined;
}

/**
 * Metadata for a single environment variable.
 *
 * @remarks
 * - `type` enables basic parsing (string, number, boolean, comma-separated strings).
 * - `transform` allows custom conversion from raw string to desired type.
 * - `zodSchema` enables full Zod-based validation and transformation.
 */
export interface envOption {
	description: string;
	options?: string[];
	default?: string | number | boolean | string[];
	required?: boolean;
	type?: 'string' | 'number' | 'boolean' | 'strings';
	name?: string;

	/** Custom parser: convert raw env value to target type. */
	transform?: (raw: string) => unknown;

	/** Zod schema to parse and validate raw env value. */
	zodSchema?: ZodTypeAny;
}

/**
 * Helper to define a record of `envOption`s with full type inference.
 */
export function defineEnvOptions<T extends Record<string, envOption>>(options: T): T {
	return options;
}

/**
 * Loader configuration for finding, merging, and debugging `.env` files.
 */
export interface EnvLoaderConfig {
	/** Paths to search for .env files (default: ['./']). */
	searchPaths?: string[];
	/** Filenames to look for in each search path (default: ['.env']). */
	fileNames?: string[];
	/** If true, merge multiple found .env files in order (default: false). Alias: `cascade`. */
	merge?: boolean;
	/** @deprecated Use `merge`. */
	cascade?: boolean;
	/** Print debug info (default: false). */
	debug?: boolean;
	/** Fallback to `process.env` if key missing in .env (default: true). */
	envFallback: boolean;
}

// Normalize key for case-insensitive comparisons
const normalizeKey = (k: string) => k.toLowerCase();

// Infer TypeScript return type for built-in parsing
type EnvOptionType<T extends envOption> = T['type'] extends 'number'
	? number
	: T['type'] extends 'boolean'
		? boolean
		: T['type'] extends 'strings'
			? string[]
			: string;

/**
 * Output config type: maps each key to its parsed type,
 * plus lowercase and alias variants.
 */
export type envConfig<T extends Record<string, envOption>> = { [K in keyof T]: EnvOptionType<T[K]> } & {
	[K in keyof T as Lowercase<K & string>]: EnvOptionType<T[K]>;
} & { [K in keyof T as T[K]['name'] extends string ? T[K]['name'] : never]: EnvOptionType<T[K]> };

/**
 * Main environment loader: merges .env files, falls back to process.env,
 * applies parsing, custom transforms, and optional Zod validation.
 */
export default class EnvLoader {
	protected config: {
		searchPaths: string[];
		fileNames: string[];
		merge: boolean;
		debug: boolean;
		envFallback: boolean;
		cascade?: boolean;
	};

	/**
	 * @param options Partial loader configuration; defaults will be applied.
	 */
	constructor(options?: Partial<EnvLoaderConfig>) {
		const merge = options?.merge ?? options?.cascade ?? false;
		this.config = {
			searchPaths: options?.searchPaths ?? ['./'],
			fileNames: options?.fileNames ?? ['.env'],
			merge,
			debug: options?.debug ?? false,
			envFallback: options?.envFallback ?? true,
			cascade: options?.cascade,
		};
	}

	/**
	 * Load and validate environment variables.
	 *
	 * @param envOptions Schema of expected environment variables.
	 * @param options Optional loader config overrides.
	 * @returns Fully typed config object.
	 */
	public static createConfig<T extends Record<string, envOption>>(
		envOptions: T,
		options?: Partial<EnvLoaderConfig>
	): envConfig<T> {
		const loader = new this(options);
		const merged = loader.load(envOptions);
		return loader.validate(merged, envOptions);
	}

	/**
	 * Like `createConfig`, but wraps the result in a Proxy that throws on unknown keys.
	 */
	public static createConfigProxy<T extends Record<string, envOption>>(
		envOptions: T,
		options?: Partial<EnvLoaderConfig>
	): envConfig<T> {
		const validated = this.createConfig(envOptions, options);
		return new Proxy(validated as Record<string, unknown>, {
			get(target, prop: string | symbol, receiver) {
				if (typeof prop !== 'string') return Reflect.get(target, prop, receiver);
				if (
					[
						'toJSON',
						'toString',
						'valueOf',
						'constructor',
						'hasOwnProperty',
						'isPrototypeOf',
						'propertyIsEnumerable',
						'then',
					].includes(prop)
				) {
					const val = Reflect.get(target, prop as keyof typeof target, receiver);
					return typeof val === 'function' ? val.bind(target) : val;
				}
				if (prop in target) return target[prop as keyof typeof target];
				// alias/name lookup
				for (const key of Object.keys(envOptions)) {
					if (envOptions[key].name === prop) return target[key as keyof typeof target];
				}
				// case-insensitive
				const lower = prop.toLowerCase();
				for (const key of Object.keys(target)) {
					if (key.toLowerCase() === lower) return target[key as keyof typeof target];
				}
				throw new Error(`Undefined environment key "${prop}"`);
			},
		}) as envConfig<T>;
	}

	// Generate a .env template file based on envOptions
	public static genTemplate<T extends Record<string, envOption>>(config: T, file: string) {
		const lines: string[] = [];
		for (const [key, opt] of Object.entries(config)) {
			const desc = opt.description ? `# ${opt.description}` : '';
			const typeInfo = opt.type ? ` [${opt.type}]` : '';
			const optionsInfo = opt.options ? ` Possible values: ${opt.options.join(', ')}` : '';
			const requiredInfo = opt.required ? ' (required)' : '';
			let defaultValue = '';
			if (opt.default !== undefined) {
				defaultValue = Array.isArray(opt.default) ? opt.default.join(',') : String(opt.default);
			}
			const example = defaultValue ? `${key}=${defaultValue}` : `${key}=`;
			lines.push(`${desc}${typeInfo}${optionsInfo}${requiredInfo}`.trim());
			lines.push(example);
			lines.push('');
		}
		writeFileSync(file, lines.join('\n'), 'utf8');
	}

	// Merge .env file entries and fallback to process.env
	protected load(envOptions: Record<string, envOption>): envVars {
		const fileEntries = this.loadEnvFiles();
		const out: envVars = {};

		for (const key of Object.keys(envOptions)) {
			const norm = normalizeKey(key);
			const fromFile = Object.entries(fileEntries).find(([k]) => normalizeKey(k) === norm);
			if (fromFile) {
				out[key] = fromFile[1];
				continue;
			}
			if (this.config.envFallback) {
				const fromProc = Object.entries(process.env).find(([k]) => normalizeKey(k) === norm);
				if (fromProc && fromProc[1] !== undefined) out[key] = fromProc[1]!;
			}
		}
		if (this.config.debug) console.log('Loaded env:', out);
		return out;
	}

	// Read all .env files according to searchPaths, fileNames, merge
	protected loadEnvFiles(): envVars {
		const cwd = process.cwd();
		const searchList = this.config.searchPaths.map((sp) => join(cwd, sp));
		const filesInOrder: string[] = [];

		for (const base of searchList) {
			for (const name of this.config.fileNames) {
				const candidate = join(base, name);
				if (existsSync(candidate)) {
					filesInOrder.push(candidate);
					if (!this.config.merge) {
						// stop at first match if not merging
						break;
					}
				}
			}
			if (filesInOrder.length && !this.config.merge) break;
		}

		if (!filesInOrder.length) return {};

		const acc: envVars = {};
		const seen: Record<string, number> = {};
		const dups: string[] = [];

		for (const file of filesInOrder) {
			const lines = readFileSync(file, 'utf8').split(/\r?\n/);
			for (const [i, line] of lines.entries()) {
				const t = line.trim();
				if (!t || t.startsWith('#')) continue;
				const m = t.match(/^([\w.-]+)\s*=\s*(.*)$/);
				if (m) {
					const key = m[1];
					const normKey = normalizeKey(key);
					if (seen[normKey] !== undefined && this.config.debug) {
						dups.push(`${key} (lines ${seen[normKey]} and ${i + 1} in ${file})`);
					}
					seen[normKey] = i + 1;
					acc[key] = m[2].replace(/^['"]|['"]$/g, '').trim();
				}
			}
		}

		if (dups.length && this.config.debug) {
			console.warn('Duplicate keys in .env files:', dups.join(', '));
		}

		return acc;
	}

	/**
	 * Validate and transform each env var using default parser, custom transform, or Zod schema.
	 */
	protected validate<T extends Record<string, envOption>>(env: envVars, opts: T): envConfig<T> {
		const missing: string[] = [];
		const errors: string[] = [];
		const result: Record<string, unknown> = {};

		for (const [key, opt] of Object.entries(opts)) {
			const raw = env[key];
			if (raw === undefined) {
				if (opt.default !== undefined) {
					result[key] = opt.default;
					continue;
				}
				if (opt.required) missing.push(key);
				continue;
			}

			try {
				let parsed: unknown;
				if (opt.transform) parsed = opt.transform(raw);
				else if (opt.zodSchema) {
					parsed = opt.zodSchema.parse(raw);
				} else parsed = this.parse(raw, opt.type);

				if (opt.options && !opt.options.includes(String(parsed))) {
					errors.push(`Invalid '${key}': ${parsed}`);
				} else {
					result[key] = parsed;
				}
			} catch (err: unknown) {
				if (err instanceof ZodError) {
					const reason = err.issues.map((issue) => issue.message).join('; ');
					errors.push(`'${key}' zod says it bad${reason ? ': ' + reason : ''}`);
				} else {
					const msg = err instanceof Error ? err.message : String(err);
					errors.push(`Error parsing '${key}': ${msg}`);
				}
			}
		}

		if (missing.length) errors.unshift(`Missing required: ${missing.join(', ')}`);
		if (errors.length) throw new Error('Env validation failed:\n' + errors.join('\n'));
		if (this.config.debug) console.log('Validated env config:', result);
		return result as envConfig<T>;
	}

	// Basic parsing of number, boolean, and comma-separated strings
	protected parse(value: string, type?: envOption['type']): string | number | boolean | string[] {
		switch (type) {
			case 'number': {
				const n = Number(value);
				if (isNaN(n)) throw new Error(`Not a number: ${value}`);
				return n;
			}
			case 'boolean': {
				const lc = value.toLowerCase();
				if (['true', '1', 'yes', 'on'].includes(lc)) return true;
				if (['false', '0', 'no', 'off'].includes(lc)) return false;
				return Boolean(value);
			}
			case 'strings':
				return value.split(',').map((s) => s.trim());
			default:
				return value;
		}
	}
}
