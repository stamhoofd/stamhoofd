import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';

import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, field, URLDecoder } from '@simonbackx/simple-encoding';
import { TTLFileCache } from '../helpers/TTLFileCache.js';
import { HtmlToPdfEndpoint } from './HtmlToPdfEndpoint.js';

type Params = Record<string, never>;
type Body = undefined;
class Query extends AutoEncoder {
    @field({decoder: new URLDecoder()})
    url: URL
}

type Data = {
    html: string;
    headers: Record<string, string>;
    statusCode: number
}

type ResponseBody = string;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PrerenderEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/prerender', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const url = request.query.url.href

        let data: Data | null = null;
        try {
            data = await PrerenderEndpoint.getUrlHtml(url, { retryCount: 2, startDate: new Date() });
        }
        catch (e) {
            console.error(e);
        }
        if (!data) {
            throw new SimpleError({
                statusCode: 503,
                code: 'unavailable',
                message: 'Could not prerender',
            });
        }
        const response = new Response(data.html);
        data.headers['content-type'] = 'text/html'
        response.headers = data.headers
        response.status = data.statusCode
        return response;
    }
    
    static readonly CACHE_TTL_MS = 60 * 1000 * 60 * 12; // 12 hours
    static fileCache = new TTLFileCache('prerender', this.CACHE_TTL_MS)

    static async getUrlHtml(url: string, options: { retryCount: number; startDate: Date }): Promise<Data | null> {        
        const existing = await this.fileCache.checkCache(url, this.CACHE_TTL_MS);
        if (existing) {
            try {
                const d = JSON.parse(existing);

                if (typeof d === 'object' && d !== null && 'html' in d && 'statusCode' in d && 'headers' in d)  {
                    return d;
                } else {
                    console.error('Invalid cached data point for ' + url)
                }
            } catch (e) {
                console.error(e);
            }
        }

        const response = await HtmlToPdfEndpoint.useBrowser(async (browser) => {
            try {
                const page = await browser.newPage();

                await page.setUserAgent({
                    userAgent: 'prerender'
                });

                await page.setJavaScriptEnabled(true);
                await page.emulateMediaType('screen');

                // ── blockResources ────────────────────────────────────────────
                // Block images, fonts, and media — we only need the HTML
                await page.setRequestInterception(true);
                const BLOCKED_RESOURCE_TYPES = new Set([
                    'image', 'media', 'font',
                    // Optionally also block these for extra speed:
                    'stylesheet', 'texttrack', 'object', 'beacon', 'csp_violationreport', 'imageset',
                ]);
                page.on('request', (req) => {
                    if (BLOCKED_RESOURCE_TYPES.has(req.resourceType())) {
                        req.abort().catch(console.error);
                    } else {
                        req.continue().catch(console.error);
                    }
                });

                // Navigate and wait until network is quiet
                const gotoResponse = await page.goto(url, {
                    waitUntil: 'networkidle0',
                    timeout: 30000,
                });

                // ── httpHeaders ───────────────────────────────────────────────
                // Read prerender meta tags and honour status/header overrides.
                // e.g. <meta name="prerender-status-code" content="404">
                //      <meta name="prerender-header" content="Location: /new-url">
                const statusCode = gotoResponse?.status() ?? 200;
                const metaStatusCode = await page
                    .evaluate(() => {
                        const el = document.querySelector('meta[name="prerender-status-code"]');
                        return el ? parseInt(el.getAttribute('content') ?? '', 10) : null;
                    })
                    .catch(() => null);

                const headers = gotoResponse?.headers();

                let effectiveStatus = metaStatusCode ?? statusCode;
                // Surface the status so callers can act on it if needed
                let metaLocation: string | undefined = undefined;
                if (effectiveStatus === 301 || effectiveStatus === 302) {
                    const dmetaLocation = await page
                        .evaluate(() => {
                            const el = document.querySelector('meta[name="prerender-header"][content^="Location"]');
                            return el ? el.getAttribute('content')?.replace(/^Location:\s*/i, '') : null;
                        });
                    if (dmetaLocation) {
                        metaLocation = dmetaLocation
                    } else {
                        // something went wrong...
                        console.error('Missing Location header')
                        effectiveStatus = 500;
                    }
                }

                // ── removeScriptTags + removePreloads ─────────────────────────
                // Strip <script> tags and <link rel="preload|modulepreload"> from the DOM
                await page.evaluate(() => {
                    // Remove all script tags
                    document.querySelectorAll('script').forEach((el) => el.remove());

                    // Remove preload / modulepreload link tags (removePreloads plugin)
                    document.querySelectorAll('link[rel="preload"][as="script"], link[rel="prefetch"][as="script"], link[rel="modulepreload"][as="script"]')
                        .forEach((el) => el.remove());
                });

                // Ibject <base href="url here" />

                if (STAMHOOFD.environment === 'test') {
                    await page.evaluate(() => {
                        const child = document.createElement('base');
                        child.href = location.href; 
                        document.head.prepend(child)

                    });
                }

                const html = await page.evaluate(() => document.documentElement.outerHTML);
                await page.close();

                if (!headers) {
                    return null;
                }

                // lowercase all headers
                const cleanedHeaders: Record<string, string> = {};
                for (const key of Object.keys(headers)) {
                    if (!headers[key]) {
                        continue;
                    }
                    const l = key.toLowerCase();
                    if (['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via', 'content-length', 'content-encoding', 'set-cookie', 'server'].includes(l)) {
                        continue;
                    }
                    cleanedHeaders[l] = headers[key]
                }

                if (metaLocation) {
                    cleanedHeaders.location = metaLocation;
                }
                delete cleanedHeaders.connection;

                return {
                    html: '<!doctype html>' + html, 
                    statusCode: effectiveStatus, 
                    headers: cleanedHeaders
                };
            } catch (e) {
                console.error('Failed to render url', e);
                return null;
            }
        });

        // Retry logic
        if (response === null && options.retryCount > 0 && Date.now() - options.startDate.getTime() < 15000) {
            return this.getUrlHtml(url, { ...options, retryCount: options.retryCount - 1 });
        }

        // Store in cache
        if (response !== null) {
            await this.fileCache.cacheFile(url, JSON.stringify(response))
            return response;

        }
        return null;

    }
}
