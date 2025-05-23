// @technomoron/env-loader
// MIT - Copyright (c) 2025 Bjørn Erik Jacobsen/Technomoron
import fs from 'fs';
import path from 'path';
import { ZodError } from 'zod';
/**
 * Helper to define a record of `envOption`s with full type inference.
 */
export function defineEnvOptions(options) {
    return options;
}
// Normalize key for case-insensitive comparisons
const normalizeKey = (k) => k.toLowerCase();
/**
 * Main environment loader: merges .env files, falls back to process.env,
 * applies parsing, custom transforms, and optional Zod validation.
 */
export default class EnvLoader {
    /**
     * @param options Partial loader configuration; defaults will be applied.
     */
    constructor(options) {
        this.config = {
            searchPaths: ['./'],
            fileNames: ['.env'],
            cascade: false,
            debug: false,
            envFallback: true,
            ...options,
        };
    }
    /**
     * Load and validate environment variables.
     *
     * @param envOptions Schema of expected environment variables.
     * @param options Optional loader config overrides.
     * @returns Fully typed config object.
     */
    static createConfig(envOptions, options) {
        const loader = new EnvLoader(options);
        const merged = loader.load(envOptions);
        return loader.validate(merged, envOptions);
    }
    /**
     * Like `createConfig`, but wraps the result in a Proxy that throws on unknown keys.
     */
    static createConfigProxy(envOptions, options) {
        const validated = EnvLoader.createConfig(envOptions, options);
        return new Proxy(validated, {
            get(target, prop, receiver) {
                if (typeof prop !== 'string')
                    return Reflect.get(target, prop, receiver);
                if ([
                    'toJSON',
                    'toString',
                    'valueOf',
                    'constructor',
                    'hasOwnProperty',
                    'isPrototypeOf',
                    'propertyIsEnumerable',
                    'then',
                ].includes(prop)) {
                    const val = Reflect.get(target, prop, receiver);
                    return typeof val === 'function' ? val.bind(target) : val;
                }
                if (prop in target)
                    return target[prop];
                // alias/name lookup
                for (const key of Object.keys(envOptions)) {
                    if (envOptions[key].name === prop)
                        return target[key];
                }
                // case-insensitive
                const lower = prop.toLowerCase();
                for (const key of Object.keys(target)) {
                    if (key.toLowerCase() === lower)
                        return target[key];
                }
                throw new Error(`Undefined environment key "${prop}"`);
            },
        });
    }
    // Generate a .env template file based on envOptions
    static genTemplate(config, file) {
        const lines = [];
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
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
    }
    // Merge .env file entries and fallback to process.env
    load(envOptions) {
        const fileEntries = this.loadEnvFiles();
        const out = {};
        for (const key of Object.keys(envOptions)) {
            const norm = normalizeKey(key);
            const fromFile = Object.entries(fileEntries).find(([k]) => normalizeKey(k) === norm);
            if (fromFile) {
                out[key] = fromFile[1];
                continue;
            }
            if (this.config.envFallback) {
                const fromProc = Object.entries(process.env).find(([k]) => normalizeKey(k) === norm);
                if (fromProc && fromProc[1] !== undefined)
                    out[key] = fromProc[1];
            }
        }
        if (this.config.debug)
            console.log('Loaded env:', out);
        return out;
    }
    // Read all .env files according to searchPaths, fileNames, cascade
    loadEnvFiles() {
        const cwd = process.cwd();
        const paths = this.config.searchPaths.flatMap((sp) => this.config.fileNames.map((fn) => path.join(cwd, sp, fn)));
        const found = paths.filter((p) => fs.existsSync(p));
        if (!found.length)
            return {};
        const file = found[0];
        const acc = {};
        const seen = {};
        const dups = [];
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        for (const [i, line] of lines.entries()) {
            const t = line.trim();
            if (!t || t.startsWith('#'))
                continue;
            const m = t.match(/^([\w.-]+)\s*=\s*(.*)$/);
            if (m) {
                const key = m[1];
                const normKey = normalizeKey(key);
                if (seen[normKey] !== undefined) {
                    dups.push(`${key} (lines ${seen[normKey]} and ${i + 1})`);
                }
                seen[normKey] = i + 1;
                acc[key] = m[2].replace(/^['"]|['"]$/g, '').trim();
            }
        }
        if (dups.length && this.config.debug) {
            console.warn('Duplicate keys in .env:', dups.join(', '));
        }
        return acc;
    }
    /**
     * Validate and transform each env var using default parser, custom transform, or Zod schema.
     */
    validate(env, opts) {
        const missing = [];
        const errors = [];
        const result = {};
        for (const [key, opt] of Object.entries(opts)) {
            const raw = env[key];
            if (raw === undefined) {
                if (opt.default !== undefined) {
                    result[key] = opt.default;
                    continue;
                }
                if (opt.required)
                    missing.push(key);
                continue;
            }
            try {
                let parsed;
                if (opt.transform)
                    parsed = opt.transform(raw);
                else if (opt.zodSchema) {
                    parsed = opt.zodSchema.parse(raw);
                }
                else
                    parsed = this.parse(raw, opt.type);
                if (opt.options && !opt.options.includes(String(parsed))) {
                    errors.push(`Invalid '${key}': ${parsed}`);
                }
                else {
                    result[key] = parsed;
                }
            }
            catch (err) {
                if (err instanceof ZodError) {
                    const reason = err.issues.map((issue) => issue.message).join('; ');
                    errors.push(`'${key}' zod says it bad${reason ? ': ' + reason : ''}`);
                }
                else {
                    const msg = err instanceof Error ? err.message : String(err);
                    errors.push(`Error parsing '${key}': ${msg}`);
                }
            }
        }
        if (missing.length)
            errors.unshift(`Missing required: ${missing.join(', ')}`);
        if (errors.length)
            throw new Error('Env validation failed:\n' + errors.join('\n'));
        if (this.config.debug)
            console.log('Validated env config:', result);
        return result;
    }
    // Basic parsing of number, boolean, and comma-separated strings
    parse(value, type) {
        switch (type) {
            case 'number': {
                const n = Number(value);
                if (isNaN(n))
                    throw new Error(`Not a number: ${value}`);
                return n;
            }
            case 'boolean': {
                const lc = value.toLowerCase();
                if (['true', '1', 'yes', 'on'].includes(lc))
                    return true;
                if (['false', '0', 'no', 'off'].includes(lc))
                    return false;
                return Boolean(value);
            }
            case 'strings':
                return value.split(',').map((s) => s.trim());
            default:
                return value;
        }
    }
}
