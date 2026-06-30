import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { localPrimaryBucket } from '../config/shared-service-config.js';
import { publicBucketPolicy, setupDevelopmentS3Buckets } from './s3-buckets.js';

const send = vi.fn();

vi.mock('../config/s3-client.js', () => ({
    createS3Client: vi.fn(() => ({ send })),
}));

function context(partial: Partial<CliContext> = {}): CliContext {
    return {
        rootDir: '/repo',
        generatedDir: '/repo/.development/cli/generated',
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
        ...partial,
    };
}

describe('setupDevelopmentS3Buckets', () => {
    beforeEach(() => {
        send.mockReset();
        send.mockResolvedValue({});
    });

    it('creates the bucket from the development config when it is missing', async () => {
        const notFound = new Error('not found') as Error & { $metadata: { httpStatusCode: number } };
        notFound.$metadata = { httpStatusCode: 404 };
        send.mockRejectedValueOnce(notFound).mockResolvedValue({});

        await setupDevelopmentS3Buckets(context());

        expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
        expect(send.mock.calls[0][0].input.Bucket).toBe(localPrimaryBucket);
        expect(send.mock.calls[1][0]).toBeInstanceOf(CreateBucketCommand);
        expect(send.mock.calls[1][0].input.Bucket).toBe(localPrimaryBucket);
        expect(send.mock.calls[2][0]).toBeInstanceOf(PutBucketPolicyCommand);
        expect(send.mock.calls[2][0].input.Bucket).toBe(localPrimaryBucket);
    });

    it('uses the isolated instance bucket from the development config', async () => {
        await setupDevelopmentS3Buckets(context({
            instance: {
                name: 'stamhoofd-feature-keeo',
                prefix: 'feature',
                primary: false,
                portOffset: 1200,
            },
        }));

        expect(send.mock.calls[0][0].input.Bucket).toBe(`${localPrimaryBucket}-stamhoofd-feature-keeo`);
        expect(send.mock.calls[1][0].input.Policy).toBe(publicBucketPolicy(`${localPrimaryBucket}-stamhoofd-feature-keeo`));
    });

    it('only grants public access to the public development prefix', () => {
        const policy = JSON.parse(publicBucketPolicy('example'));

        expect(policy.Statement).toEqual([
            {
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: 'arn:aws:s3:::example/development/p/*',
            },
        ]);
    });
});
