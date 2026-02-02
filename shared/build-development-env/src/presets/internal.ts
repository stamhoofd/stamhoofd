import { Formatter } from '@stamhoofd/utility';
import os from 'os';
import { read1PasswordCli } from '../helpers/1password.js';
import { Service } from '../Service.js';

export async function build(service: Service) {
    const config = {
        presets: [],
    };

    const username = Formatter.slug(os.userInfo().username);
    const hostname = Formatter.slug(os.hostname());

    if ('backend' in service && service.backend === 'api') {
        // In development, we do connect to a DigitalOcean database in development mode
        Object.assign(config, {
            SPACES_ENDPOINT: 'ams3.digitaloceanspaces.com',
            SPACES_BUCKET: 'stamhoofd-development',
            SPACES_KEY: await read1PasswordCli('op://Localhost/digitalocean-spaces.stamhoofd-development/key'),
            SPACES_SECRET: await read1PasswordCli('op://Localhost/digitalocean-spaces.stamhoofd-development/secret'),
            SPACES_PREFIX: username || hostname || 'unknown',
        });

        // Add Mollie credentials
        Object.assign(config, {
            MOLLIE_CLIENT_ID: await read1PasswordCli('op://Localhost/Mollie/MOLLIE_CLIENT_ID', { optional: true }),
            MOLLIE_API_KEY: await read1PasswordCli('op://Localhost/Mollie/MOLLIE_API_KEY', { optional: true }),
            MOLLIE_SECRET: await read1PasswordCli('op://Localhost/Mollie/MOLLIE_SECRET', { optional: true }),
            MOLLIE_ORGANIZATION_TOKEN: await read1PasswordCli('op://Localhost/Mollie/MOLLIE_ORGANIZATION_TOKEN', { optional: true }),

        });

        // Add Stripe credentials
        Object.assign(config, {
            STRIPE_ACCOUNT_ID: await read1PasswordCli('op://Localhost/Stripe/STRIPE_ACCOUNT_ID', { optional: true }),
            STRIPE_SECRET_KEY: await read1PasswordCli('op://Localhost/Stripe/STRIPE_SECRET_KEY', { optional: true }),
        });

        // Add UiTPAS credentials
        Object.assign(config, {
            UITPAS_API_CLIENT_ID: await read1PasswordCli('op://Localhost/UiTPAS/client_id', { optional: true }),
            UITPAS_API_CLIENT_SECRET: await read1PasswordCli('op://Localhost/UiTPAS/client_secret', { optional: true }),
            UITPAS_API_URL: await read1PasswordCli('op://Localhost/UiTPAS/api_url', { optional: true }),
        });
    }

    if ('frontend' in service) {
        // Mollie client id is required in the frontend
        Object.assign(config, {
            MOLLIE_CLIENT_ID: await read1PasswordCli('op://Localhost/Mollie/MOLLIE_CLIENT_ID', { optional: true }),
        });
    }

    return config;
}
