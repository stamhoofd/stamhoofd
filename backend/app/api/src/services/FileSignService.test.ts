import { S3Client } from '@aws-sdk/client-s3';
import { File } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { FileSignService } from './FileSignService.js';

describe('FileSignService', () => {
    let originalClient: S3Client;

    beforeEach(() => {
        TestUtils.setEnvironment('SPACES_BUCKET', 'test-bucket');
        TestUtils.setEnvironment('SPACES_ENDPOINT', 'test.digitaloceanspaces.com');

        originalClient = FileSignService.s3;
        FileSignService.s3 = new S3Client({
            forcePathStyle: false,
            endpoint: 'https://test.digitaloceanspaces.com',
            credentials: {
                accessKeyId: 'test-key',
                secretAccessKey: 'test-secret',
            },
            region: 'eu-west-1',
        });
    });

    afterEach(() => {
        FileSignService.s3 = originalClient;
    });

    const buildFile = (data: { path: string; contentType?: string | null }) => {
        return new File({
            id: '1c9ab9e6-1234-4c5e-9f1a-000000000000',
            server: 'https://test-bucket.test.digitaloceanspaces.com',
            path: data.path,
            size: 100,
            isPrivate: true,
            contentType: data.contentType ?? null,
        });
    };

    const getSignedQuery = async (file: File) => {
        const signed = await FileSignService.withSignedUrl(file);
        expect(signed?.signedUrl).toBeDefined();
        return new URL(signed!.signedUrl!).searchParams;
    };

    test('A signed url never renders a file type a browser could execute', async () => {
        const query = await getSignedQuery(buildFile({ path: 'users/1/abc/report.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));

        expect(query.get('response-content-disposition')).toBe('attachment');

        // The response headers are part of what is signed, so they can't be stripped from the url
        expect(query.get('X-Amz-SignedHeaders')).toBeDefined();
        expect(query.get('X-Amz-Signature')).toBeTruthy();
    });

    test('A signed url renders file types a browser cannot execute', async () => {
        const pdf = await getSignedQuery(buildFile({ path: 'users/1/abc/invoice.pdf', contentType: 'application/pdf' }));
        expect(pdf.get('response-content-disposition')).toBe('inline');

        const image = await getSignedQuery(buildFile({ path: 'users/1/abc/photo.jpg', contentType: 'image/jpeg' }));
        expect(image.get('response-content-disposition')).toBe('inline');
    });

    test('It downloads files that were uploaded before we validated content types', async () => {
        // These were stored with a content type chosen by the uploader, and with an extension derived from it
        const svg = await getSignedQuery(buildFile({ path: 'users/1/abc/evil.svg', contentType: 'image/svg+xml' }));
        expect(svg.get('response-content-disposition')).toBe('attachment');

        const html = await getSignedQuery(buildFile({ path: 'users/1/abc/evil', contentType: 'text/html' }));
        expect(html.get('response-content-disposition')).toBe('attachment');

        // Both the extension and the content type have to be safe
        const disguised = await getSignedQuery(buildFile({ path: 'users/1/abc/evil.pdf', contentType: 'text/html' }));
        expect(disguised.get('response-content-disposition')).toBe('attachment');
    });

    test('It uses the path when a file has no content type, like the images we generate', async () => {
        const image = await getSignedQuery(buildFile({ path: 'users/1/abc/def.png', contentType: null }));
        expect(image.get('response-content-disposition')).toBe('inline');

        const unknown = await getSignedQuery(buildFile({ path: 'users/1/abc/def', contentType: null }));
        expect(unknown.get('response-content-disposition')).toBe('attachment');
    });
});
