import { Server } from '../classes/Server';

export function buildFrontendEnv(server: Server): string {
    const env = {
        HOSTNAME_API: server.config.domains.api,
        HOSTNAME_DASHBOARD: server.config.domains.dashboard,
        HOSTNAME_REGISTRATION: server.config.domains.registration,
        HOSTNAME_WEBSHOP: server.config.domains.webshop,
    };

    return JSON.stringify(env);
}