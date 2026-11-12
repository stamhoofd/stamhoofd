import { ApplicationLifecycle } from './lifecycle.js';
import { initializeTelemetry } from './telemetry.js';

/**
 * Executable bootstrap boundary. Owns SDK initialization and startup-failure flush;
 * the application calls lifecycle.ready after initialization and lifecycle.close
 * after graceful cleanup. Does not install signal handlers or exit the process.
 */
export async function runApplication<T>(
    service: string,
    initialize: (lifecycle: ApplicationLifecycle) => Promise<T>,
): Promise<T> {
    const telemetry = initializeTelemetry(service);
    const lifecycle = new ApplicationLifecycle(service, () => telemetry.shutdown());
    try {
        return await initialize(lifecycle);
    } catch (error) {
        lifecycle.failed();
        await telemetry.shutdown();
        throw error;
    }
}
