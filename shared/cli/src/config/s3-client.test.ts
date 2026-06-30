import { describe, expect, it } from 'vitest';
import { createS3Client } from './s3-client.js';

const baseConfig = {
    SPACES_ENDPOINT: 'files.stamhoofd',
    SPACES_KEY: 'key',
    SPACES_SECRET: 'secret',
};

describe('createS3Client', () => {
    it('defaults to virtual-host style requests', async () => {
        const client = createS3Client(baseConfig);

        expect(client.config.forcePathStyle).toBe(false);
    });

    it('configures a custom CA certificate when provided', () => {
        const client = createS3Client({ ...baseConfig, SPACES_CA_CERT: 'certificate' });

        expect(client.config.requestHandler).toBeDefined();
    });
});
