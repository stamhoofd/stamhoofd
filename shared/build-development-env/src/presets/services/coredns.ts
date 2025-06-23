import { type ConcurrentlyCommandInput } from 'concurrently';

export function init(): ConcurrentlyCommandInput[] {
    return [
        {
            name: 'CoreDNS',
            command: 'yarn -s dns',
            prefixColor: 'red',
        },
    ];
}
