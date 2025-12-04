import { type ConcurrentlyCommandInput } from 'concurrently';
import util from 'util';
import { exec } from 'child_process';
import { cache } from '../../helpers/cache.js';
import { Service } from '../../Service.js';
const execPromise = util.promisify(exec);

export async function inject(config: BackendEnvironment, service: Service) {
    if (!('backend' in service) || !service.backend) {
        return {};
    }

    const secret = await cache('stripe-webhook-secret', async () => {
        console.log('Fetching Stripe webhook secret...');

        let stripeSecret;
        const stripeSecretKey = config.STRIPE_SECRET_KEY;
        const apiKeyFlag = stripeSecretKey ? ` --api-key ${stripeSecretKey}` : '';
        try {
            const stripeListenCommand = `stripe listen --print-secret${apiKeyFlag}`;
            stripeSecret = await Promise.race([
                execPromise(stripeListenCommand),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Stripe listen command timed out after 15 seconds')), 15_000)),
            ]);
        }
        catch (err) {
            console.error('Failed to fetch Stripe webhook secret:');
            console.error(err);
            throw err;
        }

        const webhookSecret = stripeSecret.stdout.trim();
        console.log('Stripe webhook secret:', webhookSecret);
        return webhookSecret;
    });

    return {
        STRIPE_ENDPOINT_SECRET: secret,
        STRIPE_CONNECT_ENDPOINT_SECRET: secret,
    };
}

export async function init(config: BackendEnvironment): Promise<ConcurrentlyCommandInput[]> {
    const stripeSecretKey = config.STRIPE_SECRET_KEY;
    const apiKeyFlag = stripeSecretKey ? ` --api-key ${stripeSecretKey}` : '';
    return [
        {
            name: 'stripe',
            command: 'stripe listen --forward-to http://' + config.domains.api + '/stripe/webhooks' + apiKeyFlag,
            prefixColor: 'red',
        },
    ];
}
