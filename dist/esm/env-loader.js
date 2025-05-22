// @technomoron/env-loader
import fs from 'fs';
import path from 'path';
// normalize keys for case-insensitive lookup
const normalizeKey = (k) => k.toLowerCase();
/** Simple load+validate, no proxy */
export function createSimpleConfig(envOptions, options) {
    const loader = new EnvLoader(options);
    const merged = loader.load(envOptions);
    return loader.validate(merged, envOptions);
}
/** Load+validate then strict proxy */
export function createProxyConfig(envOptions, options) {
    const loader = new EnvLoader(options);
    const merged = loader.load(envOptions);
    const validated = loader.validate(merged, envOptions);
    return new Proxy(validated, {
        get(target, prop, receiver) {
            // For symbols or non-string keys, delegate to Reflect
            if (typeof prop !== 'string') {
                return Reflect.get(target, prop, receiver);
            }
            // Handle built-in methods via Reflect
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
            // Exact-case lookup
            if (prop in target) {
                return target[prop];
            }
            // Alias by name property
            for (const key of Object.keys(envOptions)) {
                const opt = envOptions[key];
                if (opt.name === prop) {
                    return target[key];
                }
            }
            // Case-insensitive match
            const lower = prop.toLowerCase();
            for (const key of Object.keys(target)) {
                if (key.toLowerCase() === lower) {
                    return target[key];
                }
            }
            throw new Error(`Accessing undefined environment key "${prop}"`);
        },
    });
}
class EnvLoader {
    constructor(options) {
        this.config = {
            searchPaths: ['./'],
            fileNames: ['.env'],
            cascade: false,
            debug: false,
            ...options,
        };
    }
    /** Merge .env then process.env */
    load(envOptions) {
        const fileEntries = this.loadEnvFiles();
        const out = {};
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
                out[key] = pv[1];
            }
        }
        if (this.config.debug)
            console.log('Loaded env keys:', out);
        return out;
    }
    loadEnvFiles() {
        const cwd = process.cwd();
        const paths = this.config.searchPaths.flatMap((sp) => this.config.fileNames.map((fn) => path.join(cwd, sp, fn)));
        const found = paths.filter((p) => fs.existsSync(p));
        if (!found.length)
            return {};
        const toRead = this.config.cascade ? found : [found[0]];
        return toRead.reduce((acc, file) => {
            for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
                const t = line.trim();
                if (!t || t.startsWith('#'))
                    continue;
                const m = t.match(/^([\w.-]+)\s*=\s*(.*)$/);
                if (m)
                    acc[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
            }
            return acc;
        }, {});
    }
    /** Validate defaults, required, types, options */
    validate(env, envOptions) {
        const errors = [];
        const result = {};
        for (const [key, opt] of Object.entries(envOptions)) {
            const raw = env[key];
            // default fallback
            if (raw === undefined && opt.default !== undefined) {
                result[key] = opt.default;
                continue;
            }
            // required
            if (raw === undefined) {
                if (opt.required)
                    errors.push(`Missing required: ${key}`);
                continue;
            }
            // parse
            try {
                const parsed = this.parse(raw, opt.type);
                if (opt.options && !opt.options.includes(String(parsed))) {
                    errors.push(`Invalid ${key}: ${parsed}`);
                }
                else {
                    result[key] = parsed;
                }
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                errors.push(`Error parsing ${key}: ${msg}`);
            }
        }
        if (errors.length)
            throw new Error('Env validation failed:\n' + errors.join('\n'));
        if (this.config.debug)
            console.log('Validated env config:', result);
        return result;
    }
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
export default EnvLoader;
