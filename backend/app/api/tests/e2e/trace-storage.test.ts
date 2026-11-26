import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { Image, Invoice } from '@stamhoofd/models';
import { InvoicePdfService } from '../../src/services/InvoicePdfService.js';
import { InvoiceXMlService } from '../../src/services/InvoiceXMLService.js';

it('records one bounded provider failure per PDF and XML put and preserves the SDK rejection', async () => {
    const records = new InMemorySpanExporter();
    const runtime = initializeTelemetry('api', {
        ownsMetrics: false,
        localProcessor: new SimpleSpanProcessor({ exporter: records }),
    });
    const timeout = Object.assign(Error('private text'), {
        name: 'TimeoutError',
        $metadata: { attempts: 3, httpStatusCode: '503', requestId: 'private' },
    });
    const denied = Object.assign(Error('private text'), {
        $metadata: { attempts: -1, httpStatusCode: 403, requestId: 'private' },
    });
    const send = vi
        .spyOn(Image.getS3Client(), 'send')
        .mockRejectedValueOnce(timeout)
        .mockRejectedValueOnce(denied);
    try {
        const invoice = new Invoice();
        await traceEndpoint({}, 'POST', async () => {
            await expect(InvoicePdfService.uploadPdf(invoice, Buffer.from('private'))).rejects.toBe(
                timeout,
            );
            await expect(InvoiceXMlService.uploadXml(invoice, Buffer.from('private'))).rejects.toBe(
                denied,
            );
            return { status: 200 };
        });
        expect(send).toHaveBeenCalledTimes(2);
        const spans = records.getFinishedSpans();
        const puts = spans.filter((s) => s.name === 'storage.put');
        expect(puts.map((s) => s.attributes)).toEqual([
            { 'error.type': 'timeout', 'retry.count': 2 },
            { 'error.type': 'http_status', 'http.response.status_code': 403 },
        ]);
        expect(
            puts.every(
                (s) =>
                    s.parentSpanContext?.spanId === spans.at(-1)?.spanContext().spanId &&
                    Number(s.status.code) === 2,
            ),
        ).toBe(true);
    } finally {
        send.mockRestore();
        await runtime.shutdown();
    }
});
