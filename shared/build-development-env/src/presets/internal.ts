import { Service } from '../Service';

export function build(service: Service): any {
    console.log('todo: implement internal preset');
    const config = {
        presets: [],

        // todo: read secrets from 1Password
    };

    return config;
}
