import type { DecodedRequest, Request } from "@simonbackx/simple-endpoints";
import { Endpoint, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
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
} from "@stamhoofd/sgv";
import type { SGVMemberListFilter, SGVMemberPatch } from "@stamhoofd/sgv";
import { sgvMockState } from "../state/mock-state.js";

type Params = { path: string };
type Query = undefined;
type Body = unknown;
type ResponseBody = any;

const SGV_DEBUG_PATH = "/";

/** Implements the subset of SGV endpoints needed by local sync development and Playwright tests. */
export class SGVMockEndpoint extends Endpoint<
    Params,
    Query,
    Body,
    ResponseBody
> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (!["GET", "POST", "PATCH"].includes(request.method)) {
            return [false];
        }

        const url = parseUrl(request.url);
        if (
            (request.method === "GET" && url.pathname === SGV_DEBUG_PATH) ||
            matchesKnownPath(url.pathname)
        ) {
            return [true, { path: url.pathname }];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const url = parseUrl(request.url);
        addRequestQuery(url, request.request.query);
        const path = url.pathname;

        if (request.method === "GET" && path === SGV_DEBUG_PATH) {
            return html(renderDebugPage());
        }

        if (request.method === "GET" && path === SGV_LOGIN_AUTHORIZE_PATH) {
            return redirectToOAuthCallback(url);
        }

        if (request.method === "POST" && path === SGV_LOGIN_TOKEN_PATH) {
            return json(sgvMockState.token());
        }

        if (request.method === "GET" && path === SGV_GROUP_PATH) {
            return json({ groepen: sgvMockState.groups });
        }

        if (request.method === "GET" && path === SGV_FUNCTION_PATH) {
            return json({ functies: sgvMockState.functions });
        }

        if (request.method === "POST" && path === SGV_FUNCTION_PATH) {
            return json(
                sgvMockState.createFunction(await bodyObject(request)),
                201,
            );
        }

        if (request.method === "GET" && path === SGV_PROFILE_PATH) {
            return json(sgvMockState.profile());
        }

        if (
            request.method === "PATCH" &&
            path === SGV_MEMBER_LIST_FILTER_PATH
        ) {
            sgvMockState.currentFilter = (await bodyObject(
                request,
            )) as SGVMemberListFilter;
            return new Response(undefined);
        }

        if (request.method === "GET" && path === SGV_MEMBER_LIST_PATH) {
            const offset = numberQuery(url, "offset", 0);
            const aantal = numberQuery(url, "aantal", 100);
            return json({
                aantal: Math.min(
                    aantal,
                    Math.max(sgvMockState.members.length - offset, 0),
                ),
                offset,
                totaal: sgvMockState.members.length,
                leden: sgvMockState.listMembers(offset, aantal),
            });
        }

        if (request.method === "GET" && path === SGV_SEARCH_SIMILAR_PATH) {
            return json({
                leden: sgvMockState.searchSimilar(
                    url.searchParams.get("voornaam") ?? "",
                    url.searchParams.get("achternaam") ?? "",
                ),
            });
        }

        if (request.method === "POST" && path === SGV_MEMBER_PATH) {
            return json(
                sgvMockState.createMember(
                    (await bodyObject(request)) as SGVMemberPatch,
                ),
                201,
            );
        }

        const memberId = memberIdFromPath(path);
        if (memberId && request.method === "GET") {
            const member = sgvMockState.getMember(memberId);
            if (!member) {
                throw notFound(memberId);
            }
            return json(member);
        }

        if (memberId && request.method === "PATCH") {
            const member = sgvMockState.patchMember(
                memberId,
                (await bodyObject(request)) as SGVMemberPatch,
            );
            if (!member) {
                throw notFound(memberId);
            }
            return json(member);
        }

        throw new SimpleError({
            code: "not_found",
            message: `Unsupported SGV mock endpoint: ${request.method} ${path}`,
            statusCode: 404,
        });
    }
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
    return new URL(url, "https://admin.sgv.stamhoofd");
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
            url.searchParams.set(key, `${value}`);
        }
    }
}

function numberQuery(url: URL, key: string, fallback: number): number {
    const value = Number.parseInt(url.searchParams.get(key) ?? "", 10);
    return Number.isFinite(value) ? value : fallback;
}

function requiredQuery(url: URL, key: string): string {
    const value = url.searchParams.get(key);
    if (!value) {
        throw new SimpleError({
            code: "missing_oauth_parameter",
            message: `Missing OAuth parameter: ${key}`,
            statusCode: 400,
        });
    }
    return value;
}

/** Simulates SGV OAuth by validating required parameters and redirecting directly with a deterministic mock code. */
function redirectToOAuthCallback(url: URL): Response<undefined> {
    requiredQuery(url, "client_id");
    const redirectUri = requiredQuery(url, "redirect_uri");
    const state = requiredQuery(url, "state");
    requiredQuery(url, "response_type");
    requiredQuery(url, "scope");

    const callback = new URL(redirectUri);
    callback.searchParams.set("code", "sgv-mock");
    callback.searchParams.set("state", state);

    return new Response(undefined, 302, { Location: callback.toString() });
}

async function bodyObject(
    request: DecodedRequest<Params, Query, Body>,
): Promise<Record<string, any>> {
    const raw = await request.request.body;
    if (!raw) {
        return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
        return {};
    }
    return parsed as Record<string, any>;
}

function notFound(memberId: string): SimpleError {
    return new SimpleError({
        code: "not_found",
        message: `SGV member not found: ${memberId}`,
        statusCode: 404,
    });
}

function json(body: any, status?: number): Response<string> {
    return new Response(JSON.stringify(body), status, {
        "Content-Type": "application/json",
    });
}

function html(body: string): Response<string> {
    return new Response(body, 200, {
        "Content-Type": "text/html; charset=utf-8",
    });
}

/** Renders the current in-memory mock state for manual debugging during local development. */
function renderDebugPage(): string {
    const state = JSON.stringify({
        groups: sgvMockState.groups,
        functions: sgvMockState.functions,
        members: sgvMockState.members,
        currentFilter: sgvMockState.currentFilter,
    }).replace(/</g, "\\u003c");

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
