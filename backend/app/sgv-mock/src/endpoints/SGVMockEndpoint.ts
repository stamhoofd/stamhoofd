import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, encodeObject, field, ObjectData, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import {
    SGV_FUNCTION_PATH,
    SGV_GROUP_PATH,
    SGV_LOGIN_AUTHORIZE_PATH,
    SGV_LOGIN_TOKEN_PATH,
    SGV_MEMBER_LIST_FILTER_PATH,
    SGV_MEMBER_LIST_PATH,
    SGV_MEMBER_PATH,
    SGV_PROFILE_PATH,
    SGV_SEARCH_SIMILAR_PATH,
    SGVFunctieCreateRequest,
    SGVGFunctieResponse,
    SGVGroepResponse,
    SGVLedenLijstFilterRequest,
    SGVLedenLijstMockResponse,
    SGVLidPatch,
    SGVZoekenResponse,
} from '@stamhoofd/sgv';
import { sgvMockState } from '../state/mock-state.js';

type Params = { path: string };
type Query = undefined;
type Body = unknown;
type ResponseBody = any;

const SGV_DEBUG_PATH = '/';
const SGV_TEST_RESET_PATH = '/__test/reset';
const SGV_TEST_STATE_PATH = '/__test/state';
const SGV_TEST_FAILURES_PATH = '/__test/failures';
const SGV_MOCK_CLIENT_ID = 'groep-O2209G-Prins-Boudewijn-Wetteren';
const SGV_MOCK_REFRESH_TOKEN = 'sgv-mock-refresh-token';

class SGVMockTokenRequest extends AutoEncoder {
    @field({ decoder: StringDecoder, field: 'grant_type' })
    grantType = '';

    @field({ decoder: StringDecoder, field: 'client_id' })
    clientId = '';

    @field({ decoder: StringDecoder, optional: true })
    code?: string;

    @field({ decoder: StringDecoder, optional: true, field: 'redirect_uri' })
    redirectUri?: string;

    @field({ decoder: StringDecoder, optional: true, field: 'refresh_token' })
    refreshToken?: string;
}

/** Implements the subset of SGV endpoints needed by local sync development and Playwright tests. */
export class SGVMockEndpoint extends Endpoint<
    Params,
    Query,
    Body,
    ResponseBody
> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (!['GET', 'POST', 'PATCH'].includes(request.method)) {
            return [false];
        }

        const url = parseUrl(request.url);
        if (
            (request.method === 'GET' && url.pathname === SGV_DEBUG_PATH)
            || matchesTestPath(url.pathname)
            || matchesKnownPath(url.pathname)
        ) {
            return [true, { path: url.pathname }];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const url = parseUrl(request.url);
        addRequestQuery(url, request.request.query);
        const path = url.pathname;
        const body = await bodyObject(request);

        sgvMockState.recordCall({
            method: request.method,
            path,
            query: queryObject(url),
            body,
        });

        const failure = sgvMockState.consumeFailure(request.method, path);
        if (failure) {
            return json(failure.body ?? { error: 'SGV mock failure' }, failure.status);
        }

        if (request.method === 'GET' && path === SGV_DEBUG_PATH) {
            return html(renderDebugPage());
        }

        if (request.method === 'POST' && path === SGV_TEST_RESET_PATH) {
            sgvMockState.reset();
            return json(sgvMockState.snapshot());
        }

        if (request.method === 'GET' && path === SGV_TEST_STATE_PATH) {
            return json(sgvMockState.snapshot());
        }

        if (request.method === 'POST' && path === SGV_TEST_STATE_PATH) {
            try {
                sgvMockState.setState(body);
                return json(sgvMockState.snapshot());
            } catch (error) {
                return json({ error: error instanceof Error ? error.message : String(error) }, 400);
            }
        }

        if (request.method === 'POST' && path === SGV_TEST_FAILURES_PATH) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            sgvMockState.addFailure(body as any);
            return json(sgvMockState.snapshot());
        }

        if (request.method === 'GET' && path === SGV_LOGIN_AUTHORIZE_PATH) {
            return redirectToOAuthCallback(url);
        }

        if (request.method === 'POST' && path === SGV_LOGIN_TOKEN_PATH) {
            return json(tokenResponse(body));
        }

        if (request.method === 'GET' && path === SGV_GROUP_PATH) {
            return json(SGVGroepResponse.create({ groepen: sgvMockState.groups }));
        }

        if (request.method === 'GET' && path === SGV_FUNCTION_PATH) {
            return json(SGVGFunctieResponse.create({ functies: sgvMockState.functions }));
        }

        if (request.method === 'POST' && path === SGV_FUNCTION_PATH) {
            return json(
                sgvMockState.createFunction(decodeObject(body, SGVFunctieCreateRequest as Decoder<SGVFunctieCreateRequest>)),
                201,
            );
        }

        if (request.method === 'GET' && path === SGV_PROFILE_PATH) {
            return json(sgvMockState.profile());
        }

        if (
            request.method === 'PATCH'
            && path === SGV_MEMBER_LIST_FILTER_PATH
        ) {
            sgvMockState.currentFilter = decodeObject(
                body,
                SGVLedenLijstFilterRequest as Decoder<SGVLedenLijstFilterRequest>,
            );
            return json({});
        }

        if (request.method === 'GET' && path === SGV_MEMBER_LIST_PATH) {
            const offset = numberQuery(url, 'offset', 0);
            const aantal = numberQuery(url, 'aantal', 100);
            return json(SGVLedenLijstMockResponse.create({
                aantal: Math.min(
                    aantal,
                    Math.max(sgvMockState.members.length - offset, 0),
                ),
                offset,
                totaal: sgvMockState.members.length,
                leden: sgvMockState.listMembers(offset, aantal),
            }));
        }

        if (request.method === 'GET' && path === SGV_SEARCH_SIMILAR_PATH) {
            return json(SGVZoekenResponse.create({
                leden: sgvMockState.searchSimilar(
                    url.searchParams.get('voornaam') ?? '',
                    url.searchParams.get('achternaam') ?? '',
                ),
            }));
        }

        if (request.method === 'POST' && path === SGV_MEMBER_PATH) {
            return json(
                sgvMockState.createMember(
                    decodeObject(body, SGVLidPatch as Decoder<SGVLidPatch>),
                ),
                201,
            );
        }

        const memberId = memberIdFromPath(path);
        if (memberId && request.method === 'GET') {
            const member = sgvMockState.getMember(memberId);
            if (!member) {
                throw notFound(memberId);
            }
            return json(member);
        }

        if (memberId && request.method === 'PATCH') {
            const member = sgvMockState.patchMember(
                memberId,
                decodeObject(body, SGVLidPatch as Decoder<SGVLidPatch>),
            );
            if (!member) {
                throw notFound(memberId);
            }
            return json(member);
        }

        throw new SimpleError({
            code: 'not_found',
            message: `Unsupported SGV mock endpoint: ${request.method} ${path}`,
            statusCode: 404,
        });
    }
}

function matchesTestPath(path: string): boolean {
    return [SGV_TEST_RESET_PATH, SGV_TEST_STATE_PATH, SGV_TEST_FAILURES_PATH].includes(path);
}

function matchesKnownPath(path: string): boolean {
    return (
        [
            SGV_LOGIN_AUTHORIZE_PATH,
            SGV_LOGIN_TOKEN_PATH,
            SGV_GROUP_PATH,
            SGV_FUNCTION_PATH,
            SGV_PROFILE_PATH,
            SGV_MEMBER_LIST_FILTER_PATH,
            SGV_MEMBER_LIST_PATH,
            SGV_SEARCH_SIMILAR_PATH,
            SGV_MEMBER_PATH,
        ].includes(path) || memberIdFromPath(path) !== null
    );
}

function memberIdFromPath(path: string): string | null {
    if (!path.startsWith(`${SGV_MEMBER_PATH}/`)) {
        return null;
    }
    const id = path.slice(SGV_MEMBER_PATH.length + 1);
    return id.length > 0 ? decodeURIComponent(id) : null;
}

function parseUrl(url: string): URL {
    return new URL(url, 'https://admin.sgv.stamhoofd');
}

function addRequestQuery(url: URL, query: Record<string, unknown>) {
    for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                url.searchParams.append(key, `${item}`);
            }
            continue;
        }

        if (value !== undefined && value !== null) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
            url.searchParams.set(key, `${value}`);
        }
    }
}

function numberQuery(url: URL, key: string, fallback: number): number {
    const value = Number.parseInt(url.searchParams.get(key) ?? '', 10);
    return Number.isFinite(value) ? value : fallback;
}

function requiredQuery(url: URL, key: string): string {
    const value = url.searchParams.get(key);
    if (!value) {
        throw new SimpleError({
            code: 'missing_oauth_parameter',
            message: `Missing OAuth parameter: ${key}`,
            statusCode: 400,
        });
    }
    return value;
}

function assertValue(value: string, expected: string, key: string) {
    if (value !== expected) {
        throw oauthError(`Invalid OAuth parameter: ${key}, expected ${expected}, got ${value}`);
    }
}

/** Simulates SGV OAuth by validating required parameters and redirecting directly with a deterministic mock code. */
function redirectToOAuthCallback(url: URL): Response<undefined> {
    const clientId = requiredQuery(url, 'client_id');
    const redirectUri = requiredQuery(url, 'redirect_uri');
    const state = requiredQuery(url, 'state');
    assertValue(clientId, SGV_MOCK_CLIENT_ID, 'client_id');
    assertValue(requiredQuery(url, 'response_type'), 'code', 'response_type');
    assertValue(requiredQuery(url, 'response_mode'), 'query', 'response_mode');
    assertValue(requiredQuery(url, 'scope'), 'openid', 'scope');

    const callback = new URL(redirectUri);
    const code = sgvMockState.createAuthorizationCode({ clientId, redirectUri });
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', state);

    return new Response(undefined, 302, { Location: callback.toString() });
}

function tokenResponse(body: Record<string, any>) {
    const request = decodeObject(body, SGVMockTokenRequest as Decoder<SGVMockTokenRequest>);
    assertValue(request.clientId, SGV_MOCK_CLIENT_ID, 'client_id');

    if (request.grantType === 'authorization_code') {
        if (!request.code || !request.redirectUri) {
            throw oauthError('Missing OAuth authorization code parameters');
        }

        const details = sgvMockState.consumeAuthorizationCode(request.code);
        if (!details || details.clientId !== request.clientId || details.redirectUri !== request.redirectUri) {
            throw oauthError('Invalid OAuth authorization code', 401);
        }
        return sgvMockState.token();
    }

    if (request.grantType === 'refresh_token') {
        if (request.refreshToken !== SGV_MOCK_REFRESH_TOKEN) {
            throw oauthError('Invalid OAuth refresh token', 401);
        }
        return sgvMockState.token();
    }

    throw oauthError(`Unsupported OAuth grant type: ${request.grantType}`);
}

function oauthError(message: string, statusCode = 400): SimpleError {
    return new SimpleError({
        code: 'invalid_oauth_request',
        message,
        statusCode,
    });
}

async function bodyObject(
    request: DecodedRequest<Params, Query, Body>,
): Promise<Record<string, any>> {
    const raw = await request.request.body;
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        return parsed;
    } catch (e) {
        const parsed = new URLSearchParams(raw);
        return Object.fromEntries(parsed.entries());
    }
}

function queryObject(url: URL): Record<string, string | string[]> {
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of url.searchParams.entries()) {
        const current = query[key];
        if (current === undefined) {
            query[key] = value;
        } else if (Array.isArray(current)) {
            current.push(value);
        } else {
            query[key] = [current, value];
        }
    }
    return query;
}

function decodeObject<T>(
    body: Record<string, any>,
    decoder: Decoder<T>,
): T {
    return new ObjectData(body, { version: 0 }).decode(decoder);
}

function notFound(memberId: string): SimpleError {
    return new SimpleError({
        code: 'not_found',
        message: `SGV member not found: ${memberId}`,
        statusCode: 404,
    });
}

function json(body: any, status?: number): Response<string> {
    return new Response(JSON.stringify(encodeObject(body, { version: 0 })), status, {
        'Content-Type': 'application/json',
    });
}

function html(body: string): Response<string> {
    return new Response(body, 200, {
        'Content-Type': 'text/html; charset=utf-8',
    });
}

/** Renders the current in-memory mock state for manual debugging during local development. */
function renderDebugPage(): string {
    const state = JSON.stringify({
        groups: sgvMockState.groups,
        functions: sgvMockState.functions,
        members: sgvMockState.members,
        currentFilter: sgvMockState.currentFilter,
    }).replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SGV mock data</title>
    <style>
        :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { margin: 0; background: #f5f5f4; color: #1c1917; }
        main { max-width: 1200px; margin: 0 auto; padding: 24px; }
        h1 { margin: 0 0 8px; font-size: 28px; }
        h2 { margin: 32px 0 12px; font-size: 18px; }
        .muted { color: #78716c; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0; }
        .card { padding: 16px; background: white; border: 1px solid #e7e5e4; border-radius: 10px; }
        .card strong { display: block; font-size: 26px; }
        .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
        input, button { font: inherit; border: 1px solid #d6d3d1; border-radius: 8px; padding: 8px 10px; background: white; color: inherit; }
        input { min-width: min(360px, 100%); }
        button { cursor: pointer; }
        table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e7e5e4; border-radius: 10px; overflow: hidden; }
        th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #e7e5e4; vertical-align: top; }
        th { background: #fafaf9; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #57534e; }
        tr[data-json] { cursor: pointer; }
        tr[data-json]:hover td { background: #fafaf9; }
        pre { overflow: auto; padding: 12px; background: #1c1917; color: #fafaf9; border-radius: 8px; font-size: 12px; line-height: 1.45; }
        .hidden { display: none; }
        @media (prefers-color-scheme: dark) {
            body { background: #1c1917; color: #fafaf9; }
            .card, input, button, table { background: #292524; border-color: #44403c; }
            th { background: #1c1917; color: #d6d3d1; }
            td, th { border-color: #44403c; }
            tr[data-json]:hover td { background: #44403c; }
            .muted { color: #a8a29e; }
        }
    </style>
</head>
<body>
    <main>
        <h1>SGV mock data</h1>
        <p class="muted">Live in-memory state for this mock process. Click rows to inspect full JSON.</p>
        <section class="cards" id="summary"></section>
        <section>
            <h2>Members</h2>
            <div class="toolbar"><input id="memberSearch" type="search" placeholder="Search members by name, id or member number"></div>
            <div id="members"></div>
        </section>
        <section>
            <h2>Functions</h2>
            <div id="functions"></div>
        </section>
        <section>
            <h2>Groups</h2>
            <div id="groups"></div>
        </section>
        <section>
            <h2>Current filter</h2>
            <pre id="currentFilter"></pre>
        </section>
        <section>
            <h2>Raw state</h2>
            <div class="toolbar"><button id="copyRaw" type="button">Copy JSON</button></div>
            <pre id="rawState"></pre>
        </section>
    </main>
    <script>
        const state = ${state};
        const columns = {
            members: [
                ['id', item => item.id],
                ['First name', item => item.vgagegevens?.voornaam],
                ['Last name', item => item.vgagegevens?.achternaam],
                ['Birth date', item => item.vgagegevens?.geboortedatum],
                ['Member number', item => item.verbondsgegevens?.lidnummer],
                ['Functions', item => (item.functies || []).length],
            ],
            functions: [
                ['id', item => item.id],
                ['Description', item => item.beschrijving],
                ['Type', item => item.type],
                ['Code', item => item.code],
                ['Groups', item => (item.groepen || []).join(', ')],
            ],
            groups: [
                ['Group number', item => item.groepsnummer],
                ['Name', item => item.naam || item.naamKort || item.beschrijving],
                ['Raw keys', item => Object.keys(item).join(', ')],
            ],
        };

        function text(value) {
            if (value === null || value === undefined || value === '') return '-';
            return String(value);
        }

        function renderSummary() {
            const items = [
                ['Members', state.members.length],
                ['Functions', state.functions.length],
                ['Groups', state.groups.length],
                ['Current filter', state.currentFilter ? 'set' : 'none'],
            ];
            document.getElementById('summary').replaceChildren(...items.map(([label, value]) => {
                const card = document.createElement('div');
                card.className = 'card';
                const strong = document.createElement('strong');
                strong.textContent = value;
                const span = document.createElement('span');
                span.textContent = label;
                card.append(strong, span);
                return card;
            }));
        }

        function renderTable(targetId, rows, tableColumns) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');
            const header = document.createElement('tr');
            for (const [label] of tableColumns) {
                const th = document.createElement('th');
                th.textContent = label;
                header.append(th);
            }
            thead.append(header);

            for (const row of rows) {
                const tr = document.createElement('tr');
                tr.dataset.json = JSON.stringify(row, null, 2);
                for (const [, getValue] of tableColumns) {
                    const td = document.createElement('td');
                    td.textContent = text(getValue(row));
                    tr.append(td);
                }
                tbody.append(tr);

                const detail = document.createElement('tr');
                detail.className = 'hidden';
                const td = document.createElement('td');
                td.colSpan = tableColumns.length;
                const pre = document.createElement('pre');
                pre.textContent = tr.dataset.json;
                td.append(pre);
                detail.append(td);
                tbody.append(detail);

                tr.addEventListener('click', () => detail.classList.toggle('hidden'));
            }

            table.append(thead, tbody);
            document.getElementById(targetId).replaceChildren(table);
        }

        function memberMatches(member, query) {
            const haystack = [
                member.id,
                member.vgagegevens?.voornaam,
                member.vgagegevens?.achternaam,
                member.vgagegevens?.geboortedatum,
                member.verbondsgegevens?.lidnummer,
            ].join(' ').toLowerCase();
            return haystack.includes(query.toLowerCase());
        }

        renderSummary();
        renderTable('members', state.members, columns.members);
        renderTable('functions', state.functions, columns.functions);
        renderTable('groups', state.groups, columns.groups);
        document.getElementById('currentFilter').textContent = JSON.stringify(state.currentFilter, null, 2);
        document.getElementById('rawState').textContent = JSON.stringify(state, null, 2);
        document.getElementById('memberSearch').addEventListener('input', event => {
            renderTable('members', state.members.filter(member => memberMatches(member, event.target.value)), columns.members);
        });
        document.getElementById('copyRaw').addEventListener('click', async () => {
            await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
        });
    </script>
</body>
</html>`;
}
