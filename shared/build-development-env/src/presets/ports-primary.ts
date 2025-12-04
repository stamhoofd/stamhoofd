import { Service } from '../Service.js';

export function build(service: Service): any {
    if ('frontend' in service) {
        switch (service.frontend) {
            case 'dashboard': {
                return {
                    PORT: 8080,
                };
            }
            case 'registration': {
                return {
                    PORT: 8081,
                };
            }
            case 'webshop': {
                return {
                    PORT: 8082,
                };
            }
            case 'calculator': {
                return {
                    PORT: 8083,
                };
            }
            default: {
                throw new Error(`Unknown frontend service: ${service.frontend as unknown as string}`);
            }
        }
    }

    switch (service.backend) {
        case 'api': {
            return {
                PORT: 9091,
            };
        }
        case 'redirecter': {
            return {
                PORT: 9092,
            };
        }
        case 'renderer': {
            return {
                PORT: 9093,
            };
        }
        case 'backup': {
            return {
                PORT: 9094,
            };
        }
        default: {
            throw new Error(`Unknown backend service: ${service.backend as unknown as string}`);
        }
    }
}
