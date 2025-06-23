import { type ConcurrentlyCommandInput } from 'concurrently';

export function init(config: SharedEnvironment): ConcurrentlyCommandInput[] {
    return [
        {
            name: 'stripe',
            command: 'stripe listen --forward-to http://' + config.domains.api + '/stripe/webhooks',
            prefixColor: 'red',
        },
    ];
}
