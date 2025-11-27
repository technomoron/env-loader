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
export declare function defineEnvOptions<T extends Record<string, envOption>>(options: T): T;
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
type EnvOptionType<T extends envOption> = T['type'] extends 'number' ? number : T['type'] extends 'boolean' ? boolean : T['type'] extends 'strings' ? string[] : string;
/**
 * Output config type: maps each key to its parsed type,
 * plus lowercase and alias variants.
 */
export type envConfig<T extends Record<string, envOption>> = {
    [K in keyof T]: EnvOptionType<T[K]>;
} & {
    [K in keyof T as Lowercase<K & string>]: EnvOptionType<T[K]>;
} & {
    [K in keyof T as T[K]['name'] extends string ? T[K]['name'] : never]: EnvOptionType<T[K]>;
};
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
    constructor(options?: Partial<EnvLoaderConfig>);
    /**
     * Load and validate environment variables.
     *
     * @param envOptions Schema of expected environment variables.
     * @param options Optional loader config overrides.
     * @returns Fully typed config object.
     */
    static createConfig<T extends Record<string, envOption>>(envOptions: T, options?: Partial<EnvLoaderConfig>): envConfig<T>;
    /**
     * Like `createConfig`, but wraps the result in a Proxy that throws on unknown keys.
     */
    static createConfigProxy<T extends Record<string, envOption>>(envOptions: T, options?: Partial<EnvLoaderConfig>): envConfig<T>;
    static genTemplate<T extends Record<string, envOption>>(config: T, file: string): void;
    protected load(envOptions: Record<string, envOption>): envVars;
    protected loadEnvFiles(): envVars;
    /**
     * Validate and transform each env var using default parser, custom transform, or Zod schema.
     */
    protected validate<T extends Record<string, envOption>>(env: envVars, opts: T): envConfig<T>;
    protected parse(value: string, type?: envOption['type']): string | number | boolean | string[];
}
export {};
