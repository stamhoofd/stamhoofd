import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'node:https';

// TODO: split S3 client creation into a smaller shared package. It lives in
// @stamhoofd/cli for now because @stamhoofd/backend-env imports the CLI in
// development, so putting it there would create a cyclic dependency.

export type S3ClientEnvironment = {
    SPACES_ENDPOINT: string;
    SPACES_KEY: string;
    SPACES_SECRET: string;
    AWS_REGION?: string;
    SPACES_FORCE_PATH_STYLE?: boolean | string;
    SPACES_CA_CERT?: string | Buffer;
};

export function createS3Client(config: S3ClientEnvironment): S3Client {
    if (parseBoolean(config.SPACES_FORCE_PATH_STYLE)) {
        throw new Error('SPACES_FORCE_PATH_STYLE=true is not supported yet because file URLs currently assume virtual-host style.');
    }

    return new S3Client({
        forcePathStyle: false,
        endpoint: 'https://' + config.SPACES_ENDPOINT,
        credentials: {
            accessKeyId: config.SPACES_KEY,
            secretAccessKey: config.SPACES_SECRET,
        },
        region: config.AWS_REGION ?? 'eu-west-1',
        requestHandler: config.SPACES_CA_CERT
            ? new NodeHttpHandler({
                    httpsAgent: new https.Agent({
                        ca: config.SPACES_CA_CERT,
                    }),
                })
            : undefined,
    });
}

function parseBoolean(value: boolean | string | undefined): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    return value === 'true';
}
