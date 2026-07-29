import type { S3Client } from '@aws-sdk/client-s3';
import { Invoice, Image } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import { InvoicePdfService } from './InvoicePdfService.js';
import { InvoiceXMlService } from './InvoiceXMLService.js';

describe('invoice file storage keys', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-29T00:15:00.000Z'));
        TestUtils.setEnvironment('environment', 'staging');
        TestUtils.setEnvironment('SPACES_PREFIX', 'tenant');
        TestUtils.setEnvironment('SPACES_BUCKET', 'files');
        TestUtils.setEnvironment('SPACES_ENDPOINT', 'objects.example.com');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        TestUtils.loadEnvironment();
    });

    test('stores signed PDF and XML files under the organization-private UTC day prefix', async () => {
        const send = vi.fn().mockResolvedValue({});
        vi.spyOn(Image, 'getS3Client').mockReturnValue({ send } as unknown as S3Client);
        const invoice = new Invoice();
        invoice.organizationId = 'organization-id';
        invoice.number = '2026-001';

        const pdf = await InvoicePdfService.uploadPdf(invoice, Buffer.from('pdf'));
        const xml = await InvoiceXMlService.uploadXml(invoice, Buffer.from('xml'));

        expect(pdf.path).toMatch(/^tenant\/staging\/d\/2026\/07\/29\/users\/organization-id\/([^/]+)\/\1\.pdf$/);
        expect(xml.path).toMatch(/^tenant\/staging\/d\/2026\/07\/29\/users\/organization-id\/([^/]+)\/\1\.xml$/);
        expect(send.mock.calls.map(call => call[0].input)).toEqual([
            expect.objectContaining({ Key: pdf.path, ACL: 'private' }),
            expect.objectContaining({ Key: xml.path, ACL: 'private' }),
        ]);
        await expect(pdf.verify()).resolves.toBe(true);
        await expect(xml.verify()).resolves.toBe(true);
    });
});
