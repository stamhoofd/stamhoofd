import { Toast } from '#overlays/Toast.ts';
import type { Invoice } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function useDownloadInvoice() {
    async function downloadInvoice(invoice: Invoice) {
        const url = invoice.xml ? invoice.xml?.getPublicPath() : invoice.pdf?.getPublicPath();

        if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.setAttribute('download', (invoice.invoicedAt ? (Formatter.dateIso(invoice.invoicedAt) + ' - ') : '') + 'Stamhoofd ' + (invoice.number?.toString() ?? invoice.id));
            a.click();
        } else {
            Toast.error($t('%1bY')).show();
        }
    }

    async function downloadInvoicePdf(invoice: Invoice) {
        const url = invoice.pdf?.getPublicPath();

        if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.setAttribute('download', (invoice.invoicedAt ? (Formatter.dateIso(invoice.invoicedAt) + ' - ') : '') + 'Stamhoofd ' + (invoice.number ?? invoice.id));
            a.click();
        } else {
            Toast.error($t('%1Xu')).show();
        }
    }

    return {
        downloadInvoice, downloadInvoicePdf,
    };
}
