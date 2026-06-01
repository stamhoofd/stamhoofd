import type {ConcurrentlyCommandInput} from 'concurrently';

export function init(): ConcurrentlyCommandInput[] {
    return [
        {
            name: 'Frontend Type Checking',
            command: 'pnpm -s frontend:types --watch --preserveWatchOutput',
            prefixColor: 'blue',
        },
    ];
}
