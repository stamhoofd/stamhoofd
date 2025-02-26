import { config } from 'dotenv';

config()

type EnvVariables = {
    // Path to the directory containing your files that should be checked for translation keys
    readonly I18NUUID_ROOT: string;
    // Directories that should be ignored
    readonly I18NUUID_EXCLUDE_DIRS_ARRAY: string[];
}

function getVariables(): EnvVariables {
    const emptyVariables: EnvVariables = {
        I18NUUID_ROOT: '',
        I18NUUID_EXCLUDE_DIRS_ARRAY: ['dist', 'esm', 'node_modules']
    };

    setVariables(emptyVariables);
    return emptyVariables;
}

function setVariables(emptyVariables: EnvVariables) {
    const env = process.env;
    Object.keys(emptyVariables).forEach(key => {
        const value = env[key];
        if (!Boolean(value)) {
            console.error(`Missing env variable ${key}`);
            process.exit(1);
        }

        if(key.endsWith('ARRAY')) {
            emptyVariables[key] = value?.split(',');
        } else {
            emptyVariables[key] = value;
        }
        
    });
}

export const globals: EnvVariables = getVariables();
