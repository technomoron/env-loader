// @technomoron/env-loader

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
	type?: 'string' | 'number' | 'boolean' | 'strings';
	name?: string;
}

export interface envValidatorConfig {
	searchPaths?: string[];
	fileNames?: string[];
	cascade?: boolean;
	debug?: boolean;
}

// normalize keys for case-insensitive lookup
const normalizeKey = (k: string) => k.toLowerCase();

// infer TypeScript type from envOption
type EnvOptionType<T extends envOption> = T['type'] extends 'number'
	? number
	: T['type'] extends 'boolean'
		? boolean
		: T['type'] extends 'strings'
			? string[]
			: string;

/** Final config type: original, lowercase and alias keys */
export type envConfig<T extends Record<string, envOption>> =
	// original keys
	{ [K in keyof T]: EnvOptionType<T[K]> } & // lowercase aliases
	{ [K in keyof T as Lowercase<K & string>]: EnvOptionType<T[K]> } & // custom name aliases
	{ [K in keyof T as T[K]['name'] extends string ? T[K]['name'] : never]: EnvOptionType<T[K]> };

/** Simple load+validate, no proxy */
export function createSimpleConfig<T extends Record<string, envOption>>(
	envOptions: T,
	options?: envValidatorConfig
): envConfig<T> {
	const loader = new EnvLoader(options);
	const merged = loader.load(envOptions);
	return loader.validate(merged, envOptions);
}

/** Load+validate then strict proxy */
export function createProxyConfig<T extends Record<string, envOption>>(
	envOptions: T,
	options?: envValidatorConfig
): envConfig<T> {
	const loader = new EnvLoader(options);
	const merged = loader.load(envOptions);
	const validated = loader.validate(merged, envOptions);

	return new Proxy(validated as Record<string, unknown>, {
		get(target, prop: string | symbol, receiver) {
			// For symbols or non-string keys, delegate to Reflect
			if (typeof prop !== 'string') {
				return Reflect.get(target, prop, receiver);
			}

			// Handle built-in methods via Reflect
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

			// Exact-case lookup
			if (prop in target) {
				return target[prop as keyof typeof target];
			}

			// Alias by name property
			for (const key of Object.keys(envOptions)) {
				const opt = envOptions[key];
				if (opt.name === prop) {
					return target[key as keyof typeof target];
				}
			}

			// Case-insensitive match
			const lower = prop.toLowerCase();
			for (const key of Object.keys(target)) {
				if (key.toLowerCase() === lower) {
					return target[key as keyof typeof target];
				}
			}

			throw new Error(`Accessing undefined environment key "${prop}"`);
		},
	}) as envConfig<T>;
}

class EnvLoader {
	private config: Required<envValidatorConfig>;

	constructor(options?: envValidatorConfig) {
		this.config = {
			searchPaths: ['./'],
			fileNames: ['.env'],
			cascade: false,
			debug: false,
			...options,
		};
	}

	/** Merge .env then process.env */
	load(envOptions: Record<string, envOption>): envVars {
		const fileEntries = this.loadEnvFiles();
		const out: envVars = {};

		for (const key of Object.keys(envOptions)) {
			const norm = normalizeKey(key);
			// .env
			const fv = Object.entries(fileEntries).find(([k]) => normalizeKey(k) === norm);
			if (fv) {
				out[key] = fv[1];
				continue;
			}
			// process.env
			const pv = Object.entries(process.env).find(([k]) => normalizeKey(k) === norm);
			if (pv && pv[1] !== undefined) {
				out[key] = pv[1]!;
			}
		}

		if (this.config.debug) console.log('Loaded env keys:', out);
		return out;
	}

	private loadEnvFiles(): envVars {
		const cwd = process.cwd();
		const paths = this.config.searchPaths.flatMap((sp) =>
			this.config.fileNames.map((fn) => path.join(cwd, sp, fn))
		);
		const found = paths.filter((p) => fs.existsSync(p));
		if (!found.length) return {};

		const toRead = this.config.cascade ? found : [found[0]];
		return toRead.reduce<envVars>((acc, file) => {
			for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
				const t = line.trim();
				if (!t || t.startsWith('#')) continue;
				const m = t.match(/^([\w.-]+)\s*=\s*(.*)$/);
				if (m) acc[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
			}
			return acc;
		}, {});
	}

	/** Validate defaults, required, types, options */
	validate<T extends Record<string, envOption>>(env: envVars, envOptions: T): envConfig<T> {
		const errors: string[] = [];
		const result: Record<string, unknown> = {};

		for (const [key, opt] of Object.entries(envOptions)) {
			const raw = env[key];
			// default fallback
			if (raw === undefined && opt.default !== undefined) {
				result[key] = opt.default;
				continue;
			}
			// required
			if (raw === undefined) {
				if (opt.required) errors.push(`Missing required: ${key}`);
				continue;
			}
			// parse
			try {
				const parsed = this.parse(raw, opt.type);
				if (opt.options && !opt.options.includes(String(parsed))) {
					errors.push(`Invalid ${key}: ${parsed}`);
				} else {
					result[key] = parsed;
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				errors.push(`Error parsing ${key}: ${msg}`);
			}
		}

		if (errors.length) throw new Error('Env validation failed:\n' + errors.join('\n'));
		if (this.config.debug) console.log('Validated env config:', result);
		return result as envConfig<T>;
	}

	private parse(value: string, type?: envOption['type']): string | number | boolean | string[] {
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

export default EnvLoader;
