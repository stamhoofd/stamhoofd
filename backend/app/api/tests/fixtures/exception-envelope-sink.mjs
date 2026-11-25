import { writeSync } from 'node:fs';
import { setExceptionEnvelopeSink } from '@common/errors';

// Only the test owns this pipe. Capture the complete transport payload, independently of stdio.
setExceptionEnvelopeSink((envelope) => {
    writeSync(3, JSON.stringify(envelope));
});
