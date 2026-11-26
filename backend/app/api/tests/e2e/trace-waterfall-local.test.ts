import { runWaterfall } from './trace-waterfall.js';

it.skipIf(!process.env.STAM_BACKEND_TRACE_SMOKE)(
    'traces real invoice requests: local',
    () => runWaterfall('local'),
    30_000,
);
