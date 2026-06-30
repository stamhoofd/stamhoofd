import { S3Client } from '@aws-sdk/client-s3';

// TODO: split S3 client creation into a smaller shared package. It lives in
// @stamhoofd/cli for now because @stamhoofd/backend-env imports the CLI in
// development, so putting it there would create a cyclic dependency.

export type S3ClientEnvironment = {
    SPACES_ENDPOINT: string;
    SPACES_KEY: string;
    SPACES_SECRET: string;
    AWS_REGION?: string;
    SPACES_CA_CERT?: string | Buffer;
};

export function createS3Client(config: S3ClientEnvironment): S3Client {
    return new S3Client({
        forcePathStyle: false,
        endpoint: 'https://' + config.SPACES_ENDPOINT,
        credentials: {
            accessKeyId: config.SPACES_KEY,
            secretAccessKey: config.SPACES_SECRET,
        },
        region: config.AWS_REGION ?? 'eu-west-1',
    });
}
