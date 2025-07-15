import { type ConcurrentlyCommandInput } from 'concurrently';

export function init(): ConcurrentlyCommandInput[] {
    return [
        {
            name: 'Frontend Type Checking',
            command: 'yarn -s frontend:types --watch --preserveWatchOutput',
            prefixColor: 'blue',
        },
    ];
}
