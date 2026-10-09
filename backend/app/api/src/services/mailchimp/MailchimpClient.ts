import { SimpleError } from '@simonbackx/simple-errors';
import { createHash } from 'node:crypto';
import type { MailchimpExistingContact, MailchimpTagChange } from './planSync.js';

/**
 * Mailchimp allows 10 simultaneous connections per API key
 */
const MAX_CONCURRENCY = 5;
const MAX_RETRIES = 5;
const MAX_RETRY_AFTER_SECONDS = 60;
const PAGE_SIZE = 1000;

/**
 * Satisfied by both the native AbortSignal and the QueueHandler AbortSignal
 */
export type MailchimpAbortSignal = { throwIfAborted(): void };

export class MailchimpApiError extends Error {
    status: number;
    title: string;
    detail: string;

    constructor(status: number, title: string, detail: string) {
        super(`Mailchimp API error ${status}: ${title} - ${detail}`);
        this.status = status;
        this.title = title;
        this.detail = detail;
    }
}

export type MailchimpList = { id: string; name: string; memberCount: number };
export type MailchimpMergeField = { tag: string; name: string; type: string };
export type MailchimpMemberUpsert = {
    email: string;
    statusIfNew: 'subscribed' | 'pending';
    status?: 'unsubscribed';
    mergeFields: Record<string, string>;
};

function asObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new MailchimpApiError(0, 'Invalid response', 'Expected an object');
    }
    return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
    if (!Array.isArray(value)) {
        throw new MailchimpApiError(0, 'Invalid response', 'Expected an array');
    }
    return value;
}

function asString(value: unknown): string {
    if (typeof value !== 'string') {
        throw new MailchimpApiError(0, 'Invalid response', 'Expected a string');
    }
    return value;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class MailchimpClient {
    readonly apiKey: string;
    readonly dataCenter: string;

    /**
     * Base delay between retries, lowered in tests
     */
    static retryDelay = 1000;

    constructor(apiKey: string) {
        const key = apiKey.trim();
        const match = /^[0-9a-f]{16,}-([a-z]{2,4}\d{1,3})$/i.exec(key);
        if (!match) {
            throw new SimpleError({
                code: 'invalid_api_key',
                message: 'Invalid Mailchimp API key format',
                human: $t('Deze API-sleutel is ongeldig. Kopieer de volledige sleutel uit Mailchimp, inclusief het deel na het streepje (bv. -us21).'),
                field: 'apiKey',
            });
        }
        this.apiKey = key;
        this.dataCenter = match[1].toLowerCase();
    }

    static hash(email: string) {
        return createHash('md5').update(email.toLowerCase()).digest('hex');
    }

    get baseUrl() {
        return `https://${this.dataCenter}.api.mailchimp.com/3.0`;
    }

    async request(method: string, path: string, options: { query?: Record<string, string>; body?: unknown } = {}): Promise<unknown> {
        const url = new URL(this.baseUrl + path);
        for (const [key, value] of Object.entries(options.query ?? {})) {
            url.searchParams.set(key, value);
        }

        for (let attempt = 0; ; attempt++) {
            let response: Response;
            try {
                response = await fetch(url, {
                    method,
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from('stamhoofd:' + this.apiKey).toString('base64'),
                        'Accept': 'application/json',
                        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                    },
                    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
                    signal: AbortSignal.timeout(60_000),
                });
            }
            catch (e) {
                if (attempt < MAX_RETRIES) {
                    await sleep(MailchimpClient.retryDelay * 2 ** attempt);
                    continue;
                }
                throw new MailchimpApiError(0, 'Network error', e instanceof Error ? e.message : 'Could not reach Mailchimp');
            }

            if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
                // Capped: a large Retry-After would keep the organization's queue busy for hours
                const retryAfter = parseInt(response.headers.get('Retry-After') ?? '');
                await sleep(Number.isFinite(retryAfter) ? Math.min(retryAfter, MAX_RETRY_AFTER_SECONDS) * 1000 : MailchimpClient.retryDelay * 2 ** attempt);
                continue;
            }

            if (response.status === 204) {
                return null;
            }

            const text = await response.text();
            let json: unknown = null;
            try {
                json = text ? JSON.parse(text) : null;
            }
            catch {
                // Not JSON
            }

            if (!response.ok) {
                const error = typeof json === 'object' && json !== null ? json as Record<string, unknown> : {};
                throw new MailchimpApiError(
                    response.status,
                    typeof error.title === 'string' ? error.title : response.statusText,
                    typeof error.detail === 'string' ? error.detail : text,
                );
            }
            return json;
        }
    }

    /**
     * Also validates the API key
     */
    async getAccountName(): Promise<string> {
        const data = asObject(await this.request('GET', '/', { query: { fields: 'account_name' } }));
        return asString(data.account_name);
    }

    async getLists(): Promise<MailchimpList[]> {
        const data = asObject(await this.request('GET', '/lists', {
            query: { count: PAGE_SIZE.toString(), fields: 'lists.id,lists.name,lists.stats.member_count' },
        }));
        return asArray(data.lists).map((l) => {
            const list = asObject(l);
            const stats = typeof list.stats === 'object' && list.stats !== null ? list.stats as Record<string, unknown> : {};
            return {
                id: asString(list.id),
                name: asString(list.name),
                memberCount: typeof stats.member_count === 'number' ? stats.member_count : 0,
            };
        });
    }

    async getMergeFields(listId: string): Promise<MailchimpMergeField[]> {
        const data = asObject(await this.request('GET', `/lists/${encodeURIComponent(listId)}/merge-fields`, {
            query: { count: PAGE_SIZE.toString(), fields: 'merge_fields.tag,merge_fields.name,merge_fields.type' },
        }));
        return asArray(data.merge_fields).map((f) => {
            const field = asObject(f);
            return { tag: asString(field.tag), name: asString(field.name), type: asString(field.type) };
        });
    }

    async createMergeField(listId: string, field: MailchimpMergeField) {
        await this.request('POST', `/lists/${encodeURIComponent(listId)}/merge-fields`, {
            body: { tag: field.tag, name: field.name, type: field.type, required: false, public: false },
        });
    }

    /**
     * Includes archived contacts (status 'archived'): Mailchimp leaves them out unless they are requested separately
     */
    async getMembers(listId: string, signal?: MailchimpAbortSignal): Promise<Map<string, MailchimpExistingContact>> {
        const result = new Map<string, MailchimpExistingContact>();
        for (const status of [null, 'archived']) {
            for (let offset = 0; ; offset += PAGE_SIZE) {
                signal?.throwIfAborted();
                const data = asObject(await this.request('GET', `/lists/${encodeURIComponent(listId)}/members`, {
                    query: {
                        count: PAGE_SIZE.toString(),
                        offset: offset.toString(),
                        fields: 'members.email_address,members.status,members.tags,members.merge_fields,total_items',
                        ...(status ? { status } : {}),
                    },
                }));
                const members = asArray(data.members);
                for (const m of members) {
                    const member = asObject(m);
                    const email = asString(member.email_address).toLowerCase();
                    result.set(email, {
                        email,
                        status: asString(member.status),
                        tags: Array.isArray(member.tags) ? member.tags.map(t => asString(asObject(t).name)) : [],
                        mergeFields: typeof member.merge_fields === 'object' && member.merge_fields !== null ? member.merge_fields as Record<string, unknown> : {},
                    });
                }
                const total = typeof data.total_items === 'number' ? data.total_items : 0;
                if (members.length < PAGE_SIZE || offset + PAGE_SIZE >= total) {
                    break;
                }
            }
        }
        return result;
    }

    /**
     * Creates or updates a contact. status_if_new is only used for new contacts, so existing contacts keep their status.
     */
    async upsertMember(listId: string, member: MailchimpMemberUpsert) {
        await this.request('PUT', `/lists/${encodeURIComponent(listId)}/members/${MailchimpClient.hash(member.email)}`, {
            query: { skip_merge_validation: 'true' },
            body: {
                email_address: member.email,
                status_if_new: member.statusIfNew,
                ...(member.status ? { status: member.status } : {}),
                merge_fields: member.mergeFields,
            },
        });
    }

    async updateTags(listId: string, email: string, tags: MailchimpTagChange[]) {
        if (tags.length === 0) {
            return;
        }
        await this.request('POST', `/lists/${encodeURIComponent(listId)}/members/${MailchimpClient.hash(email)}/tags`, {
            // Bulk changes should not start tag-based automations in Mailchimp
            body: { tags, is_syncing: true },
        });
    }

    /**
     * Archives the contact. This can be undone in Mailchimp.
     */
    async archiveMember(listId: string, email: string) {
        await this.request('DELETE', `/lists/${encodeURIComponent(listId)}/members/${MailchimpClient.hash(email)}`);
    }

    static async runConcurrently<T>(items: T[], handler: (item: T) => Promise<void>, signal?: MailchimpAbortSignal) {
        let index = 0;
        let failed = false;
        const worker = async () => {
            while (index < items.length && !failed) {
                signal?.throwIfAborted();
                const item = items[index++];
                try {
                    await handler(item);
                }
                catch (e) {
                    // Stop the other workers
                    failed = true;
                    throw e;
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, () => worker()));
    }
}
