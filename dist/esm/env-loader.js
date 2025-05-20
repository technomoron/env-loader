// @technomoron/env-loader
// A customizable environment configuration validator that generates documentation
// and validates environment variables
import fs from 'fs';
import path from 'path';
export class envValidator {
    constructor(options) {
        this.envOptions = {};
        this.config = {
            searchPaths: ['./', '../', '../../'],
            fileNames: ['.env'],
            outputPath: './.env-dist',
            cascade: false,
            ...options,
        };
    }
    // Define environment variables and their validation rules
    define(envOptions) {
        this.envOptions = envOptions;
        return this;
    }
    // Generate a .env-dist file with documentation
    generateTemplate(outputPath = this.config.outputPath || './.env-dist') {
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
    validate(env = this.loadEnvFile() || {}, envOptions) {
        // Use Partial to allow incremental assignment while retaining type safety
        const validatedEnv = {};
        const errors = [];
        Object.entries(envOptions).forEach(([key, option]) => {
            const val = env[key];
            // Handle required variables
            if (option.required && !val) {
                errors.push(`Missing required environment variable: ${key}`);
                return;
            }
            // Handle default values
            if (!val && option.default !== undefined) {
                // Explicitly cast option.default to the expected type for the key
                validatedEnv[key] = option.default;
                return;
            }
            // Handle allowed options
            if (option.options && val && !option.options.includes(val)) {
                errors.push(`Invalid value for ${key}: ${val}. Must be one of: ${option.options.join(', ')}`);
                return;
            }
            // Parse and assign the value with explicit type casting
            validatedEnv[key] = this.parseValue(val || '', option.type || 'string');
        });
        if (errors.length > 0) {
            throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
        }
        // Return the fully typed, validated environment object
        return validatedEnv;
    }
    parseValue(value, type = 'string') {
        switch (type) {
            case 'boolean':
                return this.parseBoolean(value);
            case 'number':
                const numValue = Number(value);
                if (isNaN(numValue))
                    throw new Error(`Invalid number: ${value}`);
                return numValue;
            case 'strings':
                return value.split(',').map((str) => str.trim());
            default:
                return value;
        }
    }
    parseBoolean(value) {
        const truthy = new Set(['true', '1', 'yes', 'on']);
        const falsy = new Set(['false', '0', 'no', 'off']);
        return truthy.has(value.toLowerCase()) ? true : falsy.has(value.toLowerCase()) ? false : Boolean(value);
    }
    parseEnvFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').reduce((env, line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                return env;
            const [, key, value] = trimmed.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/) || [];
            if (key)
                env[key] = value?.replace(/^['"]|['"]$/g, '').trim();
            return env;
        }, {});
    }
    loadEnvFile() {
        const baseDir = process.cwd();
        const paths = (this.config.searchPaths || ['./']).flatMap((searchPath) => (this.config.fileNames || ['.env']).map((fileName) => path.join(baseDir, searchPath, fileName)));
        const existingFiles = paths.filter(fs.existsSync);
        if (!this.config.cascade) {
            return existingFiles.length > 0 ? this.parseEnvFile(existingFiles[0]) : null;
        }
        return existingFiles.reduce((mergedEnv, filePath) => {
            const parsedEnv = this.parseEnvFile(filePath);
            return { ...mergedEnv, ...parsedEnv };
        }, {});
    }
}
export default envValidator;
