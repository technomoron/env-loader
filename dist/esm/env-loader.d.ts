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
    outputPath?: string;
    cascade?: boolean;
}
type EnvOptionType<T extends envOption> = T['type'] extends 'number' ? number : T['type'] extends 'boolean' ? boolean : T['type'] extends 'strings' ? string[] : string;
export type envConfig<T extends Record<string, envOption>> = {
    [K in keyof T as T[K]['name'] extends string ? T[K]['name'] : K]: T[K]['required'] extends true ? EnvOptionType<T[K]> : EnvOptionType<T[K]> | undefined;
};
export declare class envValidator {
    private envOptions;
    private readonly config;
    constructor(options?: envValidatorConfig);
    define(envOptions: Record<string, envOption>): this;
    writeConfig(outputPath?: string): void;
    validate<T extends Record<string, envOption>>(env: envVars | undefined, envOptions: T): envConfig<T>;
    private parseValue;
    private parseBoolean;
    private parseEnvFile;
    private loadEnvFile;
}
export default envValidator;
