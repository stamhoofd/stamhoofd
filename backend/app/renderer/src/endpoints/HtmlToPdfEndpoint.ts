import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { verifyInternalSignature } from "@stamhoofd/backend-env";
import { QueueHandler } from "@stamhoofd/queues";
import formidable from 'formidable';
import { firstValues } from 'formidable/src/helpers/firstValues.js';
import { promises as fs } from "fs";
import puppeteer, { Browser } from "puppeteer";

import { FileCache } from "../helpers/FileCache";

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined
type ResponseBody = Buffer

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class HtmlToPdfEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/html-to-pdf", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const form = formidable({ 
            maxTotalFileSize: 20 * 1024 * 1024, 
            keepExtensions: false,
            maxFiles: 1
        });

        const {html, cacheId, timestamp, signature} = await new Promise<{html: string, cacheId: string, timestamp: Date, signature: string}>((resolve, reject) => {
            if (!request.request.request) {
                reject(new SimpleError({
                    code: "invalid_request",
                    message: "Invalid request",
                    statusCode: 500
                }));
                return;
            }

            form.parse(request.request.request, async (err, fieldsMultiple, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!files.html || files.html.length !== 1) {
                    reject(new SimpleError({
                        code: "missing_field",
                        message: "Field html is required",
                        field: "html"
                    }))
                    return
                }
                const fields = firstValues(form, fieldsMultiple);

                if (!fields.signature || typeof fields.signature !== "string") {
                    reject(new SimpleError({
                        code: "missing_field",
                        message: "Field signature is required",
                        field: "signature"
                    }))
                    return
                }
                if (!fields.cacheId || typeof fields.cacheId !== "string") {
                    reject(new SimpleError({
                        code: "missing_field",
                        message: "Field cacheId is required",
                        field: "cacheId"
                    }))
                    return
                }
                if (!fields.timestamp || typeof fields.timestamp !== "string") {
                    reject(new SimpleError({
                        code: "missing_field",
                        message: "Field timestamp is required",
                        field: "timestamp"
                    }))
                    return
                }

                let html;
                try {
                    html = await fs.readFile(files.html[0].filepath as string , 'utf8')
                } catch (e) {
                    reject(new SimpleError({
                        code: "invalid_field",
                        message: "Could not read html",
                        field: "html"
                    }))
                    return
                }

                resolve({
                    html,
                    signature: fields.signature,
                    cacheId: fields.cacheId,
                    timestamp: new Date(parseInt(fields.timestamp as string))
                })
            });
        });

        // Verify signature first
        if (!verifyInternalSignature(signature, cacheId, timestamp.getTime().toString(), html)) {
            throw new SimpleError({
                code: "invalid_signature",
                message: "Invalid signature"
            })
        }

        let pdf: Buffer | null = null
        try {
            pdf = await this.htmlToPdf(html, {retryCount: 2, startDate: new Date()})
        } catch (e) {
            console.error(e)
        }
        if (!pdf) {
            throw new SimpleError({
                code: "internal_error",
                message: "Could not generate pdf"
            })
        }
        await FileCache.write(cacheId, timestamp, pdf)
        const response = new Response(pdf)
        response.headers["Content-Type"] = "application/pdf"
        response.headers["Content-Length"] = pdf.byteLength.toString()
        return response;
    }

    browsers: ({browser: Browser, count: number}|null)[] = [null, null, null, null]
    nextBrowserIndex = 0

    async useBrowser<T>(callback: (browser: Browser) => Promise<T>): Promise<T> {
        this.nextBrowserIndex++;
        if (this.nextBrowserIndex >= this.browsers.length) {
            this.nextBrowserIndex = 0;
        }
        return await QueueHandler.schedule("getBrowser" + this.nextBrowserIndex, async () => {
            if (!this.browsers[this.nextBrowserIndex]) {
                this.browsers[this.nextBrowserIndex] = { browser: await puppeteer.launch({ pipe: true }), count: 0 }
            }
            const browser = this.browsers[this.nextBrowserIndex]!
            if (browser.count > 50 || !browser.browser.isConnected()) {
                try {
                    await browser.browser.close();
                } catch (e) {
                    console.error(e)
                }
                this.browsers[this.nextBrowserIndex] = { browser: await puppeteer.launch({ pipe: true }), count: 0 }
            }
            
            return await callback(browser.browser)
        });
    }

    async clearBrowser(browser: Browser) {
        try {
            await browser.close();
        } catch (e) {
            console.error(e)
        }
        const i = this.browsers.findIndex(b => b?.browser === browser)
        if (i >= 0) {
            this.browsers[i] = null
        }
    }

    /**
     * This will move to a different external service
     */
    async htmlToPdf(html: string, options: {retryCount: number, startDate: Date}): Promise<Buffer | null> {
        const response = await this.useBrowser(async (browser) => {
            try {
                // Create a new page
                const page = await browser.newPage();
                await page.setJavaScriptEnabled(false);
                await page.emulateMediaType('screen');
                await page.setContent(html, { waitUntil: 'load' })

                // Downlaod the PDF
                const pdf = await page.pdf({
                    // path: directory + this.id + '.pdf',
                    margin: { top: '50px', right: '50px', bottom: '50px', left: '50px' },
                    printBackground: true,
                    format: 'A4',
                    preferCSSPageSize: true,
                    displayHeaderFooter: false
                });
                await page.close();
                return pdf;
            } catch (e) {
                console.error('Failed to render document pdf', e)
                return null;
            }
        })
        if (response == null && options.retryCount > 0 && new Date().getTime() - options.startDate.getTime() < 15000) {
            // Retry 
            return await this.htmlToPdf(html, {...options, retryCount: options.retryCount - 1})
        }
        return response;
    }
}
