import { ServerConfig } from '../classes/Server';
import aws from './secrets/aws';
import digitaloceanSpaces from './secrets/digitalocean-spaces';
import mollieProduction from './secrets/mollie-production';
import smtp from './secrets/smtp';

const config: ServerConfig = {
    ssh: {
        user: "stamhoofd",
        ip: "206.189.243.53",
    },
    environment: "production",
    backend: {
        // Used to construct the environment variables in the backend
        env: {
            ...smtp,
            ...aws,
            ...digitaloceanSpaces,
            ...mollieProduction
        }
    }, // If is also will serve the backend
    
    domains: {
        dashboard: "stamhoofd.app",         // requires @. + www.
        registration: "stamhoofd.be",       // requires wildcard prefix DNS
        webshop: "stamhoofd.shop",          // requires wildcard prefix DNS
        api: "api.stamhoofd.app",           // requires wildcard prefix DNS + normal
    }
}

export default config;