/**
 * Generic environment variables interface that works across different environments
 */
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
}
declare class envValidator {
    private envOptions;
    private config;
    constructor(options?: envValidatorConfig);
    /**
     * Define environment variables and their validation rules
     */
    define(envOptions: Record<string, envOption>): this;
    /**
     * Generate a .env-dist file with documentation
     */
    generateTemplate(outputPath?: string): void;
    /**
     * Load and validate environment variables
     */
    validate(env?: envVars): Record<string, any>;
    private parseBoolean;
    /**
     * Parse .env file content into key-value pairs
     */
    private parseEnvFile;
    private loadEnvFile;
}
export default envValidator;
