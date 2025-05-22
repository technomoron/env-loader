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
type EnvOptionType<T extends envOption> = T['type'] extends 'number' ? number : T['type'] extends 'boolean' ? boolean : T['type'] extends 'strings' ? string[] : string;
/** Final config type: original, lowercase and alias keys */
export type envConfig<T extends Record<string, envOption>> = {
    [K in keyof T]: EnvOptionType<T[K]>;
} & // lowercase aliases
{
    [K in keyof T as Lowercase<K & string>]: EnvOptionType<T[K]>;
} & // custom name aliases
{
    [K in keyof T as T[K]['name'] extends string ? T[K]['name'] : never]: EnvOptionType<T[K]>;
};
/** Simple load+validate, no proxy */
export declare function createSimpleConfig<T extends Record<string, envOption>>(envOptions: T, options?: envValidatorConfig): envConfig<T>;
/** Load+validate then strict proxy */
export declare function createProxyConfig<T extends Record<string, envOption>>(envOptions: T, options?: envValidatorConfig): envConfig<T>;
declare class EnvLoader {
    private config;
    constructor(options?: envValidatorConfig);
    /** Merge .env then process.env */
    load(envOptions: Record<string, envOption>): envVars;
    private loadEnvFiles;
    /** Validate defaults, required, types, options */
    validate<T extends Record<string, envOption>>(env: envVars, envOptions: T): envConfig<T>;
    private parse;
}
export default EnvLoader;
