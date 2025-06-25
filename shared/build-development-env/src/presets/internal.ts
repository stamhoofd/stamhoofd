import { Service } from '../Service';
import os from 'os';
import { Formatter } from '@stamhoofd/utility';
import { read1PasswordCli } from '../helpers/1password';

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
            SPACES_KEY: await read1PasswordCli('op://DevOps Development/digitalocean-spaces.stamhoofd-development/key'),
            SPACES_SECRET: await read1PasswordCli('op://DevOps Development/digitalocean-spaces.stamhoofd-development/secret'),
            SPACES_PREFIX: username || hostname || 'unknown',
        });
    }

    return config;
}
