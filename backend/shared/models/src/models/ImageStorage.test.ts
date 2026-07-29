import type { S3Client } from '@aws-sdk/client-s3';
import { ResolutionRequest } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Image } from './Image.js';

describe('Image storage keys', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-29T00:15:00.000Z'));
        TestUtils.setEnvironment('environment', 'staging');
        TestUtils.setEnvironment('SPACES_PREFIX', 'tenant');
        TestUtils.setEnvironment('SPACES_BUCKET', 'files');
        TestUtils.setEnvironment('SPACES_ENDPOINT', 'objects.example.com');
        TestUtils.setEnvironment('SPACES_KEY', 'key');
        TestUtils.setEnvironment('SPACES_SECRET', 'secret');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        TestUtils.loadEnvironment();
    });

    test('stores public resolutions and the private source under one staging day prefix', async () => {
        const send = vi.fn().mockResolvedValue({});
        vi.spyOn(Image, 'getS3Client').mockReturnValue({ send } as unknown as S3Client);
        vi.spyOn(Image.prototype, 'save').mockResolvedValue(true);
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>');

        const image = await Image.create(
            svg,
            'image/svg+xml',
            [ResolutionRequest.create({ width: 1 })],
        );

        expect(image.resolutions).toHaveLength(1);
        expect(image.resolutions[0].file.path).toMatch(/^tenant\/staging\/d\/2026\/07\/29\/p\/[^/]+\/[^/]+\.png$/);
        expect(image.source.path).toMatch(/^tenant\/staging\/d\/2026\/07\/29\/p\/[^/]+\/[^/]+\.svg$/);
        expect(image.source.path).not.toContain('/staging/staging/');
        expect(send.mock.calls.map(call => call[0].input)).toEqual([
            expect.objectContaining({
                Key: image.resolutions[0].file.path,
                ACL: 'public-read',
            }),
            expect.objectContaining({
                Key: image.source.path,
                ACL: 'private',
            }),
        ]);
    });
});
