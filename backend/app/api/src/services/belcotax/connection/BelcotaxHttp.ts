import { SimpleError } from '@common/errors';
import { BelcotaxApiLog, BelcotaxApiLogAction } from '@stamhoofd/models';

export type BelcotaxLogContext = {
    organizationId: string | null;
    companyNumber: string | null;
    connectionId?: string | null;
    userId?: string | null;
};

export type BelcotaxHttpResponse = {
    status: number;
    json: unknown;
};

export class BelcotaxHttp {
    static timeout = 15_000;

    static async log(
        context: BelcotaxLogContext,
        data: {
            action: BelcotaxApiLogAction;
            method: string;
            url: string;
            statusCode?: number | null;
            success: boolean;
            error?: string | null;
            representativeName?: string | null;
            durationMs?: number | null;
        },
    ) {
        const log = new BelcotaxApiLog();
        log.organizationId = context.organizationId;
        log.companyNumber = context.companyNumber;
        log.connectionId = context.connectionId ?? null;
        log.userId = context.userId ?? null;
        log.action = data.action;
        log.method = data.method;
        log.url = stripQuery(data.url).substring(0, 1024);
        log.statusCode = data.statusCode ?? null;
        log.success = data.success;
        log.error = data.error ?? null;
        log.representativeName = data.representativeName ?? null;
        log.durationMs = data.durationMs ?? null;
        await log.save();
        return log;
    }

    /**
     * Sends a request to FOD and logs it. Throws only when FOD can't be reached: a response with an
     * error status is returned so the caller can interpret the body.
     */
    static async request(
        context: BelcotaxLogContext,
        action: BelcotaxApiLogAction,
        request: {
            method: string;
            url: string;
            headers?: Record<string, string>;
            body?: string | FormData;
            /**
             * In milliseconds, defaults to `BelcotaxHttp.timeout`
             */
            timeout?: number;
        },
    ): Promise<BelcotaxHttpResponse> {
        const start = Date.now();
        let response: Response;
        try {
            response = await fetch(request.url, {
                method: request.method,
                headers: { Accept: 'application/json', ...request.headers },
                body: request.body,
                signal: AbortSignal.timeout(request.timeout ?? this.timeout),
                redirect: 'error',
            });
        } catch (e) {
            await this.log(context, {
                action,
                method: request.method,
                url: request.url,
                success: false,
                error: e instanceof Error ? e.message : String(e),
                durationMs: Date.now() - start,
            });
            throw new SimpleError({
                code: 'belcotax_unreachable',
                message:
                    'Could not reach FOD Financiën: ' +
                    (e instanceof Error ? e.message : String(e)),
                human: $t('FOD Financiën is niet bereikbaar. Probeer het later opnieuw.'),
                statusCode: 503,
            });
        }

        const text = await response.text().catch(() => '');
        let json: unknown = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = null;
        }

        await this.log(context, {
            action,
            method: request.method,
            url: request.url,
            statusCode: response.status,
            success: response.ok,
            error: response.ok ? null : describeError(json, text),
            durationMs: Date.now() - start,
        });

        return { status: response.status, json };
    }
}

function stripQuery(url: string) {
    const index = url.indexOf('?');
    return index === -1 ? url : url.substring(0, index);
}

/**
 * OAuth errors (`error`, `error_description`) and RFC 9457 problems (`title`, `detail`)
 */
export function describeError(json: unknown, fallback = ''): string {
    if (json && typeof json === 'object') {
        const o = json as Record<string, unknown>;
        const parts = [o.error, o.error_description, o.type, o.title, o.detail].filter(
            (p): p is string => typeof p === 'string' && p.length > 0,
        );
        if (parts.length) {
            return parts.join(': ').substring(0, 2000);
        }
    }
    return fallback.substring(0, 500);
}
