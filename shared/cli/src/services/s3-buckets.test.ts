import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { localPrimaryBucket } from '../config/shared-service-config.js';
import { bucketCorsConfiguration, publicBucketPolicy, setupDevelopmentS3Buckets } from './s3-buckets.js';

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

    it('allows our apps to read the files of the bucket', async () => {
        await setupDevelopmentS3Buckets(context());

        // Without this, downloading a file fails in development but not in production
        const corsCommand = send.mock.calls.map(call => call[0]).find(command => command instanceof PutBucketCorsCommand);

        expect(corsCommand).toBeDefined();
        expect(corsCommand.input.Bucket).toBe(localPrimaryBucket);
        expect(corsCommand.input.CORSConfiguration).toEqual(bucketCorsConfiguration());
    });

    it('only allows reading files from any origin', () => {
        // Webshops and registration pages run on domains of our customers, so there is no list of origins
        expect(bucketCorsConfiguration().CORSRules).toEqual([
            {
                AllowedOrigins: ['*'],
                AllowedMethods: ['GET', 'HEAD'],
                AllowedHeaders: ['*'],
                ExposeHeaders: ['Content-Length', 'Content-Type', 'Content-Disposition'],
                MaxAgeSeconds: 3600,
            },
        ]);
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
