export interface envVars {
    [key: string]: string | undefined;
}
interface envOption {
    description: string;
    options?: string[];
    default?: string | number;
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'strings';
}
interface envValidatorConfig {
    searchPaths?: string[];
    fileNames?: string[];
    outputPath?: string;
    cascade?: boolean;
}
declare class envValidator {
    private envOptions;
    private readonly config;
    constructor(options?: envValidatorConfig);
    define(envOptions: Record<string, envOption>): this;
    generateTemplate(outputPath?: string): void;
    validate(env?: envVars): Record<string, string | number | boolean | string[]>;
    private parseValue;
    private parseBoolean;
    private parseEnvFile;
    private loadEnvFile;
}
export default envValidator;
