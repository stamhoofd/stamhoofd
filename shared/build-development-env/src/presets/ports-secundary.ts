import { Service } from '../Service.js';
import { build as defaultPortsBuild } from './ports-primary.js';

export function build(service: Service): any {
    const defaultPorts = defaultPortsBuild(service);

    if ('port' in defaultPorts) {
        return {
            port: defaultPorts.port + 10_000,
        };
    }

    return {
        PORT: defaultPorts.PORT + 10_000,
    };
}
