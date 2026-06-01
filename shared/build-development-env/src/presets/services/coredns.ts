import type {ConcurrentlyCommandInput} from 'concurrently';

export function init(): ConcurrentlyCommandInput[] {
    return [
        {
            name: 'CoreDNS',
            command: 'pnpm -s dns',
            prefixColor: 'red',
        },
    ];
}
