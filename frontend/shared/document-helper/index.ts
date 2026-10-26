import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import type { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import type { Document } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * Fetches currently authorized HTML and renderer grants through the session's API,
 * then returns the exact API-selected version as a cached or newly rendered PDF.
 * The supplied document identifies the resource; its local updatedAt is not used
 * to select a version. The optional owner is forwarded to every network request.
 * Aborts propagate; other cache-read failures fall back to signed HTML rendering.
 */
export async function getDocumentPdfBlob($context: SessionContext, document: Document, owner?: any): Promise<Blob> {
    // Recheck current document permissions before every renderer cache lookup.
    const response = await $context.authenticatedServer.request({
        method: 'GET',
        path: '/documents/' + encodeURIComponent(document.id) + '/html',
        shouldRetry: true,
        timeout: 60 * 1000,
        owner,
        responseType: 'blob',
    });

    if (!response.headers['x-cache-id'] || !response.headers['x-cache-timestamp'] || !response.headers['x-cache-signature']
        || !response.headers['x-cache-expires'] || !response.headers['x-cache-read-signature']) {
        throw new Error('Missing cache headers');
    }

    // Check if we have a cached version available
    try {
        const cachedResponse = await NetworkManager.rendererServer.request({
            method: 'GET',
            path: '/pdf-cache',
            query: {
                cacheId: response.headers['x-cache-id'],
                timestamp: response.headers['x-cache-timestamp'],
                expires: response.headers['x-cache-expires'],
                signature: response.headers['x-cache-read-signature'],
            },
            shouldRetry: true,
            timeout: 60 * 1000,
            owner,
            responseType: 'blob',
        });
        return cachedResponse.data as Blob;
    }
    catch (e) {
        if (Request.isAbortError(e)) {
            throw e;
        }
        let ignore = false;
        if (isSimpleError(e) || isSimpleErrors(e)) {
            if (e.hasCode('cache_not_found')) {
                ignore = true;
            }
        }
        if (!ignore) {
            console.error(e);
        }
    }

    /* if (STAMHOOFD.environment === 'development') {
        // Return html
        return response.data as Buffer;
    } */

    const form = new FormData();
    // We need to send the html as a Blob, because FormData otherwise breaks the html signature by changing LF to CRLF
    form.append('html', response.data as Blob);
    form.append('cacheId', response.headers['x-cache-id'] as string);
    form.append('timestamp', response.headers['x-cache-timestamp'] as string);
    form.append('signature', response.headers['x-cache-signature'] as string);
    form.append('expires', response.headers['x-cache-expires'] as string);

    // Convert to PDF
    const pdfResponse = await NetworkManager.rendererServer.request({
        method: 'POST',
        path: '/html-to-pdf',
        body: form as FormData,
        shouldRetry: true,
        timeout: 60 * 1000,
        owner,
        responseType: 'blob',
    });

    return pdfResponse.data as Blob;
}

export async function downloadDocument($context: SessionContext, document: Document, owner?: any) {
    try {
        const blob = await getDocumentPdfBlob($context, document, owner);
        const filename = Formatter.fileSlug(document.data.name + ' - ' + document.data.description) + '.pdf';
        await AppManager.shared.downloadFile(blob, filename);
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            Toast.fromError(e).show();
        }
        else {
            new Toast($t(`%12x`), 'info').show();
        }
    }
}

export async function downloadDocuments($context: SessionContext, documents: Document[], owner?: any) {
    if (documents.length === 1) {
        await downloadDocument($context, documents[0], owner);
        return;
    }

    let pendingToast: Toast | null = null;
    try {
        pendingToast = new Toast($t(`%12y`), 'spinner').setProgress(0).setHide(null).show();
        const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
        const zip = new JSZip();

        const entries = documents.entries();
        const maxConcurrency = 4;

        const promises = new Array(maxConcurrency).fill(0).map(async () => {
            for (const [index, document] of entries) {
                const buffer = await getDocumentPdfBlob($context, document, owner);
                zip.file(Formatter.fileSlug(document.id + ' - ' + document.data.name + ' - ' + document.data.description) + '.pdf', buffer);
                pendingToast?.setProgress((index + 1) / documents.length);
            }
        });

        await Promise.all(promises);

        pendingToast?.hide();
        pendingToast = new Toast($t(`%12z`), 'spinner').setHide(null).show();
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        await AppManager.shared.downloadFile(blob, $t(`%130`));
        pendingToast?.hide();
    }
    catch (e) {
        pendingToast?.hide();
        if (!Request.isAbortError(e)) {
            Toast.fromError(e).show();
        }
        else {
            new Toast($t(`%12x`), 'info').show();
        }
    }
}
