import { Toast } from '@stamhoofd/components'
import { NetworkManager, SessionManager } from '@stamhoofd/networking'
import { Document } from '@stamhoofd/structures'
import { Formatter } from '@stamhoofd/utility'

export async function getDocumentPdfBuffer(document: Document, owner?: any): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await SessionManager.currentSession!.authenticatedServer.request({
        method: "GET",
        path: "/documents/" + encodeURIComponent(document.id) + "/html",
        shouldRetry: false,
        timeout: 60 * 1000,
        owner,
        responseType: "text"
    })

    const html = response.data as string
    const form = new FormData()
    form.append("html", html)
    
    // Convert to PDF
    const pdfResponse = await NetworkManager.rendererServer.request({
        method: "POST",
        path: "/html-to-pdf",
        body: form as FormData,
        shouldRetry: false,
        timeout: 60 * 1000,
        owner,
        responseType: "blob"
    })

    return pdfResponse.data as Buffer
}

export async function downloadDocument(document: Document, owner?: any) {
    try {
        const buffer = await getDocumentPdfBuffer(document, owner)
        const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
        saveAs(buffer, Formatter.fileSlug(document.data.name + " - " + document.data.description) + ".pdf")
    } catch (e) {
        Toast.fromError(e).show()
    }
}

export async function downloadDocuments(documents: Document[], owner?: any) {
    if (documents.length === 1) {
        await downloadDocument(documents[0], owner)
        return
    }

    let pendingToast: Toast | null = null
    try {
        pendingToast = new Toast("Documenten downloaden...", "spinner").setProgress(0).setHide(null).show()
        const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
        const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
        const zip = new JSZip();

        for (const [index, document] of documents.entries()) {
            const buffer = await getDocumentPdfBuffer(document, owner)
            zip.file(Formatter.fileSlug(document.data.name + " - " + document.data.description) + ".pdf", buffer)
            pendingToast.setProgress((index + 1) / documents.length)
        }
        const blob = await zip.generateAsync({type:"blob"})
        saveAs(blob, "documenten.zip");
        pendingToast?.hide()
    } catch (e) {
        pendingToast?.hide()
        Toast.fromError(e).show()
    }
}