"use strict";
// @technomoron/env-loader
// MIT - Copyright (c) 2025 Bjørn Erik Jacobsen/Technomoron
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineEnvOptions = defineEnvOptions;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const zod_1 = require("zod");
function defineEnvOptions(options, meta) {
    if (meta?.group) {
        for (const key of Object.keys(options)) {
            if (!options[key].group)
                options[key].group = meta.group;
        }
    }
    return options;
}
// Normalize key for case-insensitive comparisons
const normalizeKey = (k) => k.toLowerCase();
/**
 * Main environment loader: merges .env files, falls back to process.env,
 * applies parsing, custom transforms, and optional Zod validation.
 */
class EnvLoader {
    /**
     * @param options Partial loader configuration; defaults will be applied.
     */
    constructor(options) {
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
    static createConfig(envOptions, options) {
        const loader = new this(options);
        const merged = loader.load(envOptions);
        return loader.validate(merged, envOptions);
    }
    /**
     * Like `createConfig`, but wraps the result in a Proxy that throws on unknown keys.
     */
    static createConfigProxy(envOptions, options) {
        const validated = this.createConfig(envOptions, options);
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
        return this.genTemplateFromBlocks([config], file);
    }
    // Generate a .env template file based on one or more envOption blocks
    static genTemplateFromBlocks(blocks, file) {
        const lines = [];
        let currentGroup;
        for (const block of blocks) {
            for (const [key, opt] of Object.entries(block)) {
                const group = opt.group;
                if (group && group !== currentGroup) {
                    if (lines.length && lines[lines.length - 1] !== '')
                        lines.push('');
                    lines.push(`# ${group}`);
                    currentGroup = group;
                }
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
        }
        (0, node_fs_1.writeFileSync)(file, lines.join('\n'), 'utf8');
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
    // Read all .env files according to searchPaths, fileNames, merge
    loadEnvFiles() {
        const cwd = process.cwd();
        const searchList = this.config.searchPaths.map((sp) => (0, node_path_1.join)(cwd, sp));
        const filesInOrder = [];
        for (const base of searchList) {
            for (const name of this.config.fileNames) {
                const candidate = (0, node_path_1.join)(base, name);
                if ((0, node_fs_1.existsSync)(candidate)) {
                    filesInOrder.push(candidate);
                    if (!this.config.merge) {
                        // stop at first match if not merging
                        break;
                    }
                }
            }
            if (filesInOrder.length && !this.config.merge)
                break;
        }
        if (!filesInOrder.length)
            return {};
        const acc = {};
        const seen = {};
        const dups = [];
        for (const file of filesInOrder) {
            const lines = (0, node_fs_1.readFileSync)(file, 'utf8').split(/\r?\n/);
            for (const [i, line] of lines.entries()) {
                const t = line.trim();
                if (!t || t.startsWith('#'))
                    continue;
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
                if (err instanceof zod_1.ZodError) {
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
exports.default = EnvLoader;
