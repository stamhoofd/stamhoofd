import { type ConcurrentlyCommandInput } from 'concurrently';
import { Service } from './Service.js';

export type InitFunction = (config: SharedEnvironment) => Promise<undefined | ConcurrentlyCommandInput[]>;
export async function buildPresets(presets: string[], service: Service): Promise<{ config: any; initFunctions: InitFunction[] }> {
    const defaultPrests = [];
    const todo = [...presets];

    for (const defaultPreset of defaultPrests) {
        if (!todo.includes(defaultPreset)) {
            todo.unshift(defaultPreset);
        }
    }

    const result: any = {};
    const presetsSet = new Set(todo);
    const initFunctions: InitFunction[] = [];

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let index = 0; index < todo.length; index++) {
        const preset = todo[index];

        // Loop
        const fileLocation = `./presets/${preset}.js`;
        try {
            const presetBuilder = await import(fileLocation);

            let config: any;
            if ('config' in presetBuilder) {
                config = presetBuilder.config;
            }
            else {
                if ('init' in presetBuilder) {
                    initFunctions.push(presetBuilder.init as InitFunction);
                }
                if ('build' in presetBuilder) {
                    config = await presetBuilder.build(service);
                }
            }

            if (config && 'presets' in config) {
                // Append to current loop if not yet in the loop
                for (const key of config.presets as string[]) {
                    if (!presetsSet.has(key)) {
                        presetsSet.add(key);
                        todo.push(key);
                    }
                }
            }

            if (config) {
                Object.assign(result, config);
            }
        }
        catch (error) {
            if (error.message.includes('Cannot find module') && !error.message.includes('package.json')) {
                console.error(error);
                throw new Error(`Preset ${preset} does not exist. Please check the presets directory.`);
            }
            throw new Error(`Failed to load preset ${preset}: ${error.message}`);
        }
    }

    // Some presets still need to inject things, because they depend on the total configuration of the service
    for (const preset of presetsSet) {
        const fileLocation = `./presets/${preset}.js`;
        try {
            const presetBuilder = await import(fileLocation);

            if ('inject' in presetBuilder) {
                const injectedConfig = await presetBuilder.inject(result, service);
                Object.assign(result, injectedConfig);
            }
        }
        catch (error) {
            if (error.message.includes('Cannot find module')) {
                throw new Error(`Preset ${preset} does not exist. Please check the presets directory.`);
            }
            throw new Error(`Failed to inject preset ${preset}: ${error.message}`);
        }
    }

    return {
        config: result,
        initFunctions,
    };
}
