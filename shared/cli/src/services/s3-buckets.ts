import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import fs from 'node:fs/promises';
import { buildDevelopmentConfig } from '../config/development-config.js';
import { createS3Client } from '../config/s3-client.js';
import { caddyRootCaPath } from '../config/shared-service-config.js';
import type { CliContext } from '../context/create-context.js';

export async function setupDevelopmentS3Buckets(context: CliContext): Promise<void> {
    const env = buildDevelopmentConfig(context).backendEnv;
    const bucket = env.SPACES_BUCKET;
    const client = createS3Client({
        SPACES_ENDPOINT: env.SPACES_ENDPOINT!,
        SPACES_KEY: env.SPACES_KEY!,
        SPACES_SECRET: env.SPACES_SECRET!,
        AWS_REGION: env.AWS_REGION,
        SPACES_CA_CERT: await readCaddyRootCertificate(),
    });

    if (!bucket) {
        throw new Error('Missing SPACES_BUCKET in development config');
    }

    if (!(await bucketExists(client, bucket))) {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    await client.send(new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: publicBucketPolicy(bucket),
    }));
}

async function readCaddyRootCertificate(): Promise<Buffer | undefined> {
    try {
        return await fs.readFile(caddyRootCaPath());
    } catch {
        return undefined;
    }
}

async function bucketExists(client: ReturnType<typeof createS3Client>, bucket: string): Promise<boolean> {
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return true;
    } catch (error) {
        if (isNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}

export function publicBucketPolicy(bucket: string): string {
    return JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::${bucket}/development/p/*`,
            },
        ],
    });
}

function isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
    return metadata?.httpStatusCode === 404 || error.name === 'NotFound' || error.name === 'NoSuchBucket';
}
