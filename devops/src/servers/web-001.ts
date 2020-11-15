import { ServerConfig } from '../classes/Server';

const config: ServerConfig = {
    ssh: {
        user: "stamhoofd",
        ip: "167.99.18.195",
    },
    environment: "production",
    frontend: {
        apps: ["webshop", "registration", "dashboard"]
    },
    domains: {
        dashboard: "stamhoofd.app",         // requires @. + www.
        registration: "stamhoofd.be",       // requires wildcard prefix DNS
        webshop: "stamhoofd.shop",          // requires wildcard prefix DNS
        api: "api.stamhoofd.app",           // requires wildcard prefix DNS + normal
    }
}

export default config;