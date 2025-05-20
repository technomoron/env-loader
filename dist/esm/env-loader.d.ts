export interface envVars {
    [key: string]: string | undefined;
}
export interface envOption {
    description: string;
    options?: string[];
    default?: string | number | boolean | string[];
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'strings';
}
export interface envValidatorConfig {
    searchPaths?: string[];
    fileNames?: string[];
    outputPath?: string;
    cascade?: boolean;
}
type EnvOptionType<T extends envOption> = T['type'] extends 'number' ? number : T['type'] extends 'boolean' ? boolean : T['type'] extends 'strings' ? string[] : string;
export type AppConfig<T extends Record<string, envOption>> = {
    [K in keyof T]: T[K]['required'] extends true ? EnvOptionType<T[K]> : EnvOptionType<T[K]> | undefined;
};
export declare class envValidator {
    private envOptions;
    private readonly config;
    constructor(options?: envValidatorConfig);
    define(envOptions: Record<string, envOption>): this;
    generateTemplate(outputPath?: string): void;
    validate<T extends Record<string, envOption>>(env: envVars | undefined, envOptions: T): AppConfig<T>;
    private parseValue;
    private parseBoolean;
    private parseEnvFile;
    private loadEnvFile;
}
export default envValidator;
