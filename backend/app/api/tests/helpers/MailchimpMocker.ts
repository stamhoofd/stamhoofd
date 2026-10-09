import { createHash } from 'node:crypto';
import nock from 'nock';
import { resetNock } from './resetNock.js';

export type MockedMailchimpMember = {
    email: string;
    status: string;
    tags: string[];
    mergeFields: Record<string, string>;
};

export type MockedMailchimpList = {
    id: string;
    name: string;
    mergeFields: { tag: string; name: string; type: string }[];
    members: Map<string, MockedMailchimpMember>;
};

function hash(email: string) {
    return createHash('md5').update(email.toLowerCase()).digest('hex');
}

/**
 * In-memory Mailchimp Marketing API (https://<dc>.api.mailchimp.com/3.0) with one account.
 */
export class MailchimpMocker {
    accountName = 'Scouts Gent';
    // Built at runtime: a literal key-shaped string trips GitHub's push protection
    apiKey = '0123456789abcdef'.repeat(2) + '-us21';
    lists: MockedMailchimpList[] = [];

    /**
     * Permanently deleted addresses, Mailchimp refuses to add them again
     */
    forgotten = new Set<string>();

    requests: { method: string; path: string; body: unknown }[] = [];

    /**
     * Responses returned before normal handling, one per request (e.g. a 429 with Retry-After)
     */
    forcedResponses: { status: number; body: unknown; headers?: Record<string, string> }[] = [];

    addList(id: string, name: string, members: Partial<MockedMailchimpMember>[] = []) {
        const list: MockedMailchimpList = {
            id,
            name,
            mergeFields: [
                { tag: 'FNAME', name: 'First Name', type: 'text' },
                { tag: 'LNAME', name: 'Last Name', type: 'text' },
            ],
            members: new Map(),
        };
        this.lists.push(list);
        for (const member of members) {
            this.addMember(id, member);
        }
        return list;
    }

    addMember(listId: string, member: Partial<MockedMailchimpMember>) {
        const email = member.email!.toLowerCase();
        this.lists.find(l => l.id === listId)!.members.set(hash(email), { status: 'subscribed', tags: [], mergeFields: {}, ...member, email });
    }

    getMember(listId: string, email: string) {
        return this.lists.find(l => l.id === listId)?.members.get(hash(email));
    }

    reset() {
        this.lists = [];
        this.forgotten = new Set();
        this.requests = [];
        this.forcedResponses = [];
    }

    start() {
        const scope = nock(/^https:\/\/[a-z0-9]+\.api\.mailchimp\.com(:443)?$/).persist();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const mocker = this;

        for (const method of ['get', 'put', 'post', 'delete'] as const) {
            scope[method](/^\/3\.0\//).query(true).reply(function (uri, body) {
                const authorization = this.req.headers.authorization as string | undefined;
                const forced = mocker.forcedResponses.shift();
                if (forced) {
                    mocker.requests.push({ method: method.toUpperCase(), path: uri, body });
                    return [forced.status, forced.body, forced.headers ?? {}];
                }
                return mocker.handle(method.toUpperCase(), uri, body, authorization);
            });
        }
    }

    stop() {
        this.reset();
        resetNock();
    }

    private handle(method: string, uri: string, rawBody: nock.Body, authorization: string | undefined): [number, unknown] {
        const url = new URL(uri, 'https://mailchimp.test');
        const path = url.pathname.replace(/^\/3\.0/, '');
        const body = (typeof rawBody === 'string' && rawBody ? JSON.parse(rawBody) : rawBody) as Record<string, any>;
        this.requests.push({ method, path, body });

        const expected = 'Basic ' + Buffer.from('stamhoofd:' + this.apiKey).toString('base64');
        if (authorization !== expected) {
            return [401, { title: 'API Key Invalid', detail: 'Your API key may be invalid, or you\'ve attempted to access the wrong datacenter.' }];
        }

        if (method === 'GET' && path === '/') {
            return [200, { account_name: this.accountName }];
        }
        if (method === 'GET' && path === '/lists') {
            return [200, { lists: this.lists.map(l => ({ id: l.id, name: l.name, stats: { member_count: l.members.size } })) }];
        }

        const match = /^\/lists\/([^/]+)(\/.*)?$/.exec(path);
        const list = match ? this.lists.find(l => l.id === match[1]) : undefined;
        if (!match || !list) {
            return [404, { title: 'Resource Not Found', detail: 'The requested resource could not be found.' }];
        }
        const rest = match[2] ?? '';

        if (rest === '/merge-fields') {
            if (method === 'GET') {
                return [200, { merge_fields: list.mergeFields }];
            }
            list.mergeFields.push({ tag: body.tag, name: body.name, type: body.type });
            return [200, body];
        }

        if (method === 'GET' && rest === '/members') {
            const count = parseInt(url.searchParams.get('count') ?? '10');
            const offset = parseInt(url.searchParams.get('offset') ?? '0');
            // Like Mailchimp: archived contacts are only listed when asked for explicitly
            const status = url.searchParams.get('status');
            const all = [...list.members.values()].filter(m => status ? m.status === status : m.status !== 'archived');
            return [200, {
                total_items: all.length,
                members: all.slice(offset, offset + count).map(m => ({
                    email_address: m.email,
                    status: m.status,
                    tags: m.tags.map((name, id) => ({ id, name })),
                    merge_fields: m.mergeFields,
                })),
            }];
        }

        const memberMatch = /^\/members\/([0-9a-f]+)(\/tags)?$/.exec(rest);
        if (!memberMatch) {
            return [404, { title: 'Resource Not Found', detail: 'Unknown path' }];
        }
        const member = list.members.get(memberMatch[1]);

        if (memberMatch[2]) {
            if (!member) {
                return [404, { title: 'Resource Not Found', detail: 'The requested resource could not be found.' }];
            }
            for (const tag of body.tags as { name: string; status: string }[]) {
                member.tags = member.tags.filter(t => t !== tag.name);
                if (tag.status === 'active') {
                    member.tags.push(tag.name);
                }
            }
            return [204, ''];
        }

        if (method === 'DELETE') {
            if (!member) {
                return [404, { title: 'Resource Not Found', detail: 'The requested resource could not be found.' }];
            }
            member.status = 'archived';
            return [204, ''];
        }

        if (method === 'PUT') {
            const email = (body.email_address as string).toLowerCase();
            if (hash(email) !== memberMatch[1]) {
                return [400, { title: 'Invalid Resource', detail: 'Hash does not match the email address' }];
            }
            if (this.forgotten.has(email)) {
                return [400, { title: 'Forgotten Email Not Subscribed', detail: `${email} was permanently deleted and cannot be re-imported.` }];
            }
            if (member) {
                if (body.status) {
                    member.status = body.status;
                }
                Object.assign(member.mergeFields, body.merge_fields ?? {});
                return [200, member];
            }
            const created: MockedMailchimpMember = { email, status: body.status ?? body.status_if_new, tags: [], mergeFields: { ...(body.merge_fields ?? {}) } };
            list.members.set(hash(email), created);
            return [200, created];
        }

        return [405, { title: 'Method Not Allowed', detail: method }];
    }
}
