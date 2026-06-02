import type { CliContext } from '../context/create-context.js';
import { stripeService } from './definitions/stripe-service.js';

export async function startStripe(context: CliContext): Promise<NodeJS.ProcessEnv> {
    return (await stripeService.start(context, undefined)).env ?? {};
}

export async function stopStripe(context: CliContext): Promise<void> {
    await stripeService.stop(context);
}
