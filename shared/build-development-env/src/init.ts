import { concurrently, type ConcurrentlyCommandInput } from 'concurrently';
import { buildConfig } from './build.js';
import chalk from 'chalk';

async function init() {
    console.log(chalk.magenta('[INIT]') + ' Initializing development environment...');
    const services: ConcurrentlyCommandInput[] = [];

    // Loop all presets with a init method and call that method.
    // Append responses to the services array
    const { config, initFunctions } = await buildConfig(process.env.STAMHOOFD_ENV ?? '', { backend: 'api' });

    for (const initFunction of initFunctions) {
        const s = await initFunction(config as SharedEnvironment);
        if (Array.isArray(s)) {
            services.push(...s);
        }
    }

    if (services.length === 0) {
        return;
    }

    // Run concurrently all services
    const { result } = concurrently(services, {
        prefix: 'name',
        killOthersOn: [], // don't kill on failure
        successCondition: 'first',
        cwd: process.cwd(),
    });

    try {
        await result;
    }
    catch (e) {
        // Ignore error
    }
}

init().catch((error) => {
    console.error('Error during initialization:', error);
    process.exit(1);
});
