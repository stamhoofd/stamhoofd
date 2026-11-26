import type { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { traceStage } from '@node/observability';

/** The application storage boundary. Neither the command nor its response is attached to spans. */
export function putObject(client: S3Client, command: PutObjectCommand) {
    return traceStage('storage.put', () => client.send(command));
}
