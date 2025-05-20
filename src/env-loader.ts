// @technomoron/env-loader
// A customizable environment configuration validator that generates documentation
// and validates environment variables

import fs from 'fs';
import path from 'path';


export interface envVars {
  [key: string]: string | undefined;
}

interface envOption {
    description: string;
    options?: string[];
    default?: string | number;
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'strings'; // Default 'string'
}

interface envValidatorConfig {
    searchPaths?: string[];
    fileNames?: string[];
    outputPath?: string;
    /**
     * If true, all matching env files will be loaded in sequence,
     * allowing more specific files to override values from base files
     */
    cascade?: boolean;
}

class envValidator {
  private envOptions: Record<string, envOption> = {};
  private config: envValidatorConfig;

  constructor(options?: envValidatorConfig) {
    this.config = {
      searchPaths: ['./', '../', '../../'],
      fileNames: ['.env'],
      outputPath: './.env-dist',
      cascade: false, // Default to backward compatible mode
      ...options
    };
  }

  /**
   * Define environment variables and their validation rules
   */
  define(envOptions: Record<string, envOption>): this {
    this.envOptions = envOptions;
    return this;
  }

  /**
   * Generate a .env-dist file with documentation
   */
  generateTemplate(outputPath?: string): void {
    const lines: string[] = [];
    const finalPath = outputPath || this.config.outputPath || './.env-dist';

    Object.entries(this.envOptions).forEach(([key, option]) => {
      const opt = `${option.type || 'string'}${option.required ? ' - required' : ''}`;
      lines.push(`# ${option.description} [${opt}]`);
      
      if (option.options) {
        lines.push(`# Possible values: ${option.options.join(', ')}`);
      }
      
      if (option.required) {
        lines.push(`${key}=`);
      } else if (option.default !== undefined) {
        lines.push(`# ${key}=${option.default}`);
      } else {
        lines.push(`${key}=`);
      }
      
      lines.push('');
    });
    
    fs.writeFileSync(finalPath, lines.join('\n'), 'utf8');
    console.log(`.env-dist file has been created at ${finalPath}`);
  }

  /**
   * Load and validate environment variables
   */
  validate(env?: envVars): Record<string, any> {
    // Load .env file if env not provided
    if (!env) {
      env = this.loadEnvFile() || {};
      // Check for required fields that couldn't be loaded
      const requiredFields = Object.entries(this.envOptions)
        .filter(([_, opt]) => opt.required)
        .map(([key, _]) => key);
      if (requiredFields.length > 0 && Object.keys(env).length === 0) {
        throw new Error(`No environment variables provided and no .env file found. Required fields are missing: ${requiredFields.join(', ')}`);
      }
    }

    const validatedEnv: Record<string, any> = {};
    const errors: string[] = [];

    Object.entries(this.envOptions).forEach(([key, option]) => {
      const val = env[key];
      
      if (option.required && !val) {
        errors.push(`Missing required environment variable: ${key}`);
        return;
      }
      
      if (!val && option.default !== undefined) {
        validatedEnv[key] = option.default;
        return;
      }
      
      if (option.options && val && !option.options.includes(val)) {
        errors.push(`Invalid value for ${key}: ${val}. Must be one of: ${option.options.join(', ')}`);
        return;
      }

      if (val) {
        switch (option.type) {
          case 'boolean':
            validatedEnv[key] = this.parseBoolean(val);
            break;
          case 'number': {
            const numValue = Number(val);
            if (isNaN(numValue)) {
              errors.push(`Invalid number for ${key}: ${val}`);
            } else {
              validatedEnv[key] = numValue;
            }
            break;
          }
          case 'strings':
            validatedEnv[key] = val.split(',').map((str) => str.trim());
            break;
          default: // 'string' or unspecified
            validatedEnv[key] = val;
            break;
        }
      }
    });

    if (errors.length > 0) {
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }
    
    return validatedEnv;
  }

  private parseBoolean(value: string): boolean {
    const truthyValues = ['true', '1', 'yes', 'on'];
    const falsyValues = ['false', '0', 'no', 'off'];
    
    if (truthyValues.includes(value?.toLowerCase())) return true;
    if (falsyValues.includes(value?.toLowerCase())) return false;
    
    return Boolean(value);
  }

  /**
   * Parse .env file content into key-value pairs
   */
  private parseEnvFile(filePath: string): envVars {
    const content = fs.readFileSync(filePath, 'utf8');
    const env: envVars = {};
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Match key=value pattern
      const match = trimmedLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) {
        continue;
      }
      
      const key = match[1];
      let value = (match[2] || '').trim();
      
      // Remove surrounding quotes if they exist
      if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) || 
                               (value.startsWith("'") && value.endsWith("'")))) {
        value = value.substring(1, value.length - 1);
      }
      
      env[key] = value;
    }
    
    return env;
  }

  private loadEnvFile(): envVars | null {
    try {
      const baseDir = typeof process !== 'undefined' ? process.cwd() : '.';
      const paths: string[] = [];
      
      // Create all possible combinations of paths and filenames
      (this.config.searchPaths || ['./']).forEach(searchPath => {
        (this.config.fileNames || ['.env']).forEach(fileName => {
          paths.push(path.resolve(baseDir, searchPath, fileName));
        });
      });
      
      // If not in cascade mode, return on first match (original behavior)
      if (!this.config.cascade) {
        for (const envPath of paths) {
          if (fs.existsSync(envPath)) {
            // Parse the .env file manually
            const parsedEnv = this.parseEnvFile(envPath);
            
            // Set process.env variables if in a Node.js environment
            if (typeof process !== 'undefined') {
              Object.entries(parsedEnv).forEach(([key, value]) => {
                if (value !== undefined) {
                  process.env[key] = value;
                }
              });
              console.log(`Loaded environment from ${envPath}`);
              return process.env;
            } else {
              console.log(`Loaded environment from ${envPath}`);
              return parsedEnv;
            }
          }
        }
      } else {
        // Cascade mode: find all existing files and combine them
        const existingPaths = paths.filter(p => fs.existsSync(p));
        
        if (existingPaths.length === 0) {
          return null;
        }
        
        // Start with an empty env object
        const mergedEnv: envVars = {};
        const loadedFiles: string[] = [];
        
        // Process all files in order, letting later files override earlier ones
        for (const envPath of existingPaths) {
          const parsedEnv = this.parseEnvFile(envPath);
          loadedFiles.push(envPath);
          
          // Merge with existing values, overriding as needed
          Object.entries(parsedEnv).forEach(([key, value]) => {
            if (value !== undefined) {
              mergedEnv[key] = value;
            }
          });
        }
        
        if (loadedFiles.length > 0) {
          console.log(`Loaded environment from ${loadedFiles.length} files: ${loadedFiles.join(', ')}`);
        }
        
        // Set process.env variables if in a Node.js environment
        if (typeof process !== 'undefined') {
          Object.entries(mergedEnv).forEach(([key, value]) => {
            if (value !== undefined) {
              process.env[key] = value;
            }
          });
          return process.env;
        } else {
          return mergedEnv;
        }
      }
    } catch (error) {
      console.error('Error loading environment file:', error);
    }
    
    return null;
  }
}

export default envValidator;
