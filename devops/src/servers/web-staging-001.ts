import { ServerConfig } from '../classes/Server';
import aws from './secrets/aws';
import digitaloceanSpaces from './secrets/digitalocean-spaces';
import mollieDevelopment from './secrets/mollie-development';
import smtp from './secrets/smtp';

const config: ServerConfig = {

    name: "web-staging-001",
    description: "Staging server",
    type: "web",
    ssh: {
        user: "stamhoofd",
        ip: "178.62.239.97",
    },
    caddyConfig: "web.json",
    environment: "staging",
    frontend: {
        apps: ["webshop", "registration", "dashboard"]
    },
    backend: {
        // Used to construct the environment variables in the backend
        env: {
            ...smtp,
            ...aws,
            ...digitaloceanSpaces,
            ...mollieDevelopment
        }
        
        

    }, // If is also will serve the backend
    domains: {
        dashboard: "staging.stamhoofd.app",         // requires @. + www.
        registration: "staging.stamhoofd.be",       // requires wildcard prefix DNS
        webshop: "staging.stamhoofd.shop",          // requires wildcard prefix DNS
        api: "api.staging.stamhoofd.app",           // requires wildcard prefix DNS + normal
    }
}

export default config;