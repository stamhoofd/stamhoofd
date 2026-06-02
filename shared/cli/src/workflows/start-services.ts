import type { CliContext } from '../context/create-context.js';
import { startSharedServicesInteractive } from '../services/shared-services.js';
import { success } from '../runtime/ux.js';

export async function runServices(context: CliContext): Promise<void> {
    await startSharedServicesInteractive(context);
    console.log('\nUse stam services down to stop them.');
}
