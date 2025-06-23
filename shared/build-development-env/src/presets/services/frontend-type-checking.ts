import { type ConcurrentlyCommandInput } from 'concurrently';

export function init(): ConcurrentlyCommandInput[] {
    return [
        {
            name: 'Frontend Type Checking',
            command: 'wait-on shared/object-differ/dist/index.d.ts && yarn -s frontend:types --watch --preserveWatchOutput',
            prefixColor: 'blue',
        },
    ];
}
