export type MetabaseAdmin = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
};

export type MetabaseDatabaseInput = {
    name: string;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
};

export type MetabaseDatabase = {
    id: number;
    name: string;
    engine: string;
    /** Metabase's own demo database, which it creates on setup unless told not to. */
    is_sample?: boolean;
};

export type MetabaseTable = {
    id: number;
    name: string;
    visibility_type: string | null;
};

export type MetabaseCollection = {
    id: number;
    name: string;
    archived?: boolean;
};

export type MetabaseCardInput = {
    name: string;
    description?: string;
    display: string;
    databaseId: number;
    query: string;
    templateTags: Record<string, unknown>;
    visualizationSettings: Record<string, unknown>;
    collectionId: number;
};

export type MetabaseCard = {
    id: number;
    name: string;
};

/** A shared query fragment, which questions refer to as `{{snippet: <name>}}`. */
export type MetabaseSnippet = {
    id: number;
    name: string;
    content: string;
    archived?: boolean;
};

export type MetabaseSnippetInput = {
    name: string;
    content: string;
    description?: string;
};

export type MetabaseDashboard = {
    id: number;
    name: string;
};

export type MetabaseDashboardLayout = {
    tabs: { id: number; name: string }[];
    /** The placed cards. A text box or heading holds no card, and has no `cardId`. */
    cards: { id: number; cardId: number | null; tabId: number | null }[];
};

export class MetabaseApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'MetabaseApiError';
    }
}

export type MetabaseUser = {
    id: number;
    email: string;
    is_superuser?: boolean;
};

/**
 * Minimal client for the Metabase HTTP API, enough to complete the setup wizard and register the
 * databases Metabase reports on. Metabase has no declarative provisioning in the open source
 * edition (the config file is an enterprise feature), so this is the only way to automate it.
 *
 * Two ways to authenticate, because the two environments differ in what they can hold:
 *
 * - An admin account, which also completes the setup wizard. Used against a local Metabase, where
 *   the CLI creates that account itself and knows the password.
 * - An `apiKey`, created by hand in Metabase (Admin > Settings > Authentication > API keys) and kept
 *   in 1Password. Used against a server, where nothing may hold a human's password and where the
 *   first account was made by a person.
 */
export class MetabaseApi {
    private session: string | undefined;
    private readonly apiKey: string | undefined;

    constructor(private readonly baseUrl: string, options: { apiKey?: string } = {}) {
        this.apiKey = options.apiKey;
    }

    /**
     * Metabase hands out a setup token until the wizard completed, which is also the only way to
     * create the very first user. Absent means someone already set this instance up.
     */
    async getSetupToken(): Promise<string | undefined> {
        const properties = await this.request<{ 'setup-token'?: string | null }>('GET', '/api/session/properties');
        return properties['setup-token'] ?? undefined;
    }

    /**
     * Complete the setup wizard on a fresh instance and keep the session it returns.
     */
    async setup(token: string, admin: MetabaseAdmin): Promise<void> {
        const result = await this.request<{ id: string }>('POST', '/api/setup', {
            token,
            user: {
                first_name: admin.firstName,
                last_name: admin.lastName,
                email: admin.email,
                password: admin.password,
                site_name: 'Stamhoofd',
            },
            prefs: {
                site_name: 'Stamhoofd',
                site_locale: 'en',
                allow_tracking: false,
            },
        });
        this.session = result.id;
    }

    async login(admin: MetabaseAdmin): Promise<void> {
        const result = await this.request<{ id: string }>('POST', '/api/session', {
            username: admin.email,
            password: admin.password,
        });
        this.session = result.id;
    }

    /**
     * Set the wizard up when the instance is fresh, log in when it is not. Returns whether this
     * call is what created the admin account.
     */
    async authenticate(admin: MetabaseAdmin): Promise<{ created: boolean }> {
        const token = await this.getSetupToken();
        if (token !== undefined) {
            await this.setup(token, admin);
            return { created: true };
        }
        await this.login(admin);
        return { created: false };
    }

    /** Who the current credentials belong to. */
    async currentUser(): Promise<MetabaseUser> {
        return await this.request<MetabaseUser>('GET', '/api/user/current');
    }

    /**
     * Check that the api key is accepted and belongs to an admin, before anything is written.
     *
     * A key is created by hand and can be revoked or downgraded there, so without this a stale one
     * surfaces as a 401 somewhere halfway through writing the report.
     */
    async verifyApiKey(): Promise<MetabaseUser> {
        if (this.apiKey === undefined) {
            throw new Error('No api key was configured on this client');
        }

        let user: MetabaseUser;
        try {
            user = await this.currentUser();
        }
        catch (error) {
            if (error instanceof MetabaseApiError && (error.status === 401 || error.status === 403)) {
                throw new Error(`${this.baseUrl} rejected the api key. Create a new one under Admin > Settings > Authentication > API keys and update it in 1Password.`, { cause: error });
            }
            throw error;
        }

        if (!user.is_superuser) {
            throw new Error(`The api key of ${this.baseUrl} belongs to ${user.email}, which is not an admin. Writing questions and dashboards needs a key in the Administrators group.`);
        }

        return user;
    }

    async listDatabases(): Promise<MetabaseDatabase[]> {
        const result = await this.request<{ data: MetabaseDatabase[] } | MetabaseDatabase[]>('GET', '/api/database');
        return Array.isArray(result) ? result : result.data;
    }

    async findDatabaseByName(name: string): Promise<MetabaseDatabase | undefined> {
        return (await this.listDatabases()).find(database => database.name === name);
    }

    /**
     * The registered database to write questions against, which has to be there already.
     *
     * Deliberately not created here: on a server the data source holds credentials of its own and
     * connects over SSL, so it is added once by hand and this only ever looks it up.
     */
    async requireDatabaseByName(name: string): Promise<MetabaseDatabase> {
        const match = await this.findDatabaseByName(name);
        if (!match) {
            const known = (await this.listDatabases()).map(database => database.name);
            throw new Error(`${this.baseUrl} has no data source named "${name}"${known.length > 0 ? `, only: ${known.join(', ')}` : ''}. Add it under Admin > Databases first.`);
        }
        return match;
    }

    /**
     * Register `input` as a MySQL database unless a database with the same name is already
     * registered. An existing one is left untouched, so changes made in the UI survive.
     */
    async ensureDatabase(input: MetabaseDatabaseInput): Promise<{ id: number; created: boolean }> {
        const match = await this.findDatabaseByName(input.name);
        if (match) {
            return { id: match.id, created: false };
        }

        const created = await this.request<{ id: number }>('POST', '/api/database', {
            name: input.name,
            engine: 'mysql',
            details: {
                host: input.host,
                port: input.port,
                dbname: input.database,
                user: input.user,
                password: input.password,
                ssl: false,
            },
        });
        return { id: created.id, created: true };
    }

    /**
     * Make Metabase re-read the tables of a database. It caches the schema it found when the data
     * source was registered and only refreshes on its own schedule, so a database that was still
     * empty at that moment keeps showing no tables long after the migrations created them.
     */
    async syncDatabaseSchema(id: number): Promise<void> {
        await this.request('POST', `/api/database/${id}/sync_schema`);
    }

    /**
     * Hide tables from the query builder and the data reference. Used for the schema-history table,
     * which is part of the database but has nothing to report on.
     *
     * Metabase discovers tables in a background sync, so a table that was only just created may not
     * be known yet; this waits a bounded time for it and otherwise leaves it for the next run rather
     * than holding up the command.
     */
    async hideTables(databaseId: number, names: string[], options: { timeoutMs?: number } = {}): Promise<string[]> {
        const deadline = Date.now() + (options.timeoutMs ?? 30_000);
        const hidden: string[] = [];

        for (;;) {
            const metadata = await this.request<{ tables?: MetabaseTable[] }>('GET', `/api/database/${databaseId}/metadata?include_hidden=true`);
            const tables = (metadata.tables ?? []).filter(table => names.includes(table.name));

            for (const table of tables.filter(table => table.visibility_type !== 'hidden')) {
                await this.request('PUT', `/api/table/${table.id}`, { visibility_type: 'hidden' });
                hidden.push(table.name);
            }

            if (tables.length === names.length || Date.now() >= deadline) {
                return hidden;
            }
            await new Promise(resolve => setTimeout(resolve, 2_000));
        }
    }

    /**
     * Drop Metabase's demo database. Instances started before the image was told to skip it already
     * have one, and it is only noise next to the platform statistics. Identified by the flag rather
     * than by name, which is the only thing Metabase guarantees about it.
     */
    async removeSampleDatabase(): Promise<{ removed: boolean }> {
        const sample = (await this.listDatabases()).find(database => database.is_sample === true);
        if (!sample) {
            return { removed: false };
        }

        await this.request('DELETE', `/api/database/${sample.id}`);
        return { removed: true };
    }

    async listCollections(): Promise<MetabaseCollection[]> {
        const collections = await this.request<MetabaseCollection[]>('GET', '/api/collection');
        return collections.filter(collection => collection.archived !== true);
    }

    /**
     * The collection the report lives in, created if it is not there yet. Everything the CLI writes
     * goes in one collection so it stays apart from whatever the client builds themselves.
     */
    async ensureCollection(name: string): Promise<{ id: number; created: boolean }> {
        const match = (await this.listCollections()).find(collection => collection.name === name);
        if (match) {
            return { id: match.id, created: false };
        }

        const created = await this.request<{ id: number }>('POST', '/api/collection', { name, parent_id: null });
        return { id: created.id, created: true };
    }

    /**
     * Rename a collection, keeping its id and everything in it. Used to bring a collection this
     * wrote under an earlier name along rather than leaving it beside a new one.
     */
    async renameCollection(id: number, name: string): Promise<void> {
        await this.request('PUT', `/api/collection/${id}`, { name });
    }

    /**
     * The snippets of the instance, the archived ones included. A name is held by an archived snippet
     * just as much as by a live one -- Metabase has no way to delete either -- so a fragment whose
     * snippet was thrown away has to be found and revived rather than written a second time under a
     * name that is already taken.
     */
    async listSnippets(): Promise<MetabaseSnippet[]> {
        const live = await this.request<MetabaseSnippet[]>('GET', '/api/native-query-snippet');
        const archived = await this.request<MetabaseSnippet[]>('GET', '/api/native-query-snippet?archived=true');

        return [...live, ...archived];
    }

    /**
     * Write a shared fragment. Updating an existing one rather than replacing it keeps its id, and
     * with it every question already pointing at it, so a fragment that changed reaches all of them
     * at once. An archived one is brought back: its name was never given up.
     *
     * The description is written along, cleared when the fragment no longer has one: the sidebar
     * would otherwise keep showing words the report stopped saying.
     */
    async saveSnippet(input: MetabaseSnippetInput, existingId?: number): Promise<number> {
        const body = { name: input.name, content: input.content, description: input.description ?? null };

        if (existingId !== undefined) {
            await this.request('PUT', `/api/native-query-snippet/${existingId}`, { ...body, archived: false });
            return existingId;
        }
        return (await this.request<{ id: number }>('POST', '/api/native-query-snippet', body)).id;
    }

    async listCards(collectionId: number): Promise<MetabaseCard[]> {
        const items = await this.request<{ data?: { id: number; name: string; model: string }[] }>('GET', `/api/collection/${collectionId}/items?models=card`);
        return (items.data ?? []).map(item => ({ id: item.id, name: item.name }));
    }

    async listDashboards(collectionId: number): Promise<MetabaseDashboard[]> {
        const items = await this.request<{ data?: { id: number; name: string; model: string }[] }>('GET', `/api/collection/${collectionId}/items?models=dashboard`);
        return (items.data ?? []).map(item => ({ id: item.id, name: item.name }));
    }

    /**
     * Write a native question. Updating an existing card rather than replacing it keeps its id, and
     * with it every dashboard that points at it and every link the client saved.
     */
    async saveCard(input: MetabaseCardInput, existingId?: number): Promise<number> {
        const body = {
            name: input.name,
            description: input.description ?? null,
            display: input.display,
            visualization_settings: input.visualizationSettings,
            collection_id: input.collectionId,
            dataset_query: {
                type: 'native',
                database: input.databaseId,
                native: { query: input.query, 'template-tags': input.templateTags },
            },
        };

        if (existingId !== undefined) {
            await this.request('PUT', `/api/card/${existingId}`, body);
            return existingId;
        }
        return (await this.request<{ id: number }>('POST', '/api/card', body)).id;
    }

    /**
     * Run a saved question and return the values of its first column. Used to read the values a
     * filter offers straight out of the database Metabase is already connected to, so the CLI needs
     * no database connection of its own.
     */
    async runCardValues(cardId: number): Promise<string[]> {
        const result = await this.request<{ data?: { rows?: unknown[][] } }>('POST', `/api/card/${cardId}/query`);
        return (result.data?.rows ?? [])
            .map(row => row[0])
            .filter((value): value is string => typeof value === 'string' && value.length > 0);
    }

    async createDashboard(name: string, description: string | undefined, collectionId: number): Promise<number> {
        const created = await this.request<{ id: number }>('POST', '/api/dashboard', {
            name,
            description: description ?? null,
            collection_id: collectionId,
        });
        return created.id;
    }

    /** The tabs and cards a dashboard already has, so writing it again can keep their ids. */
    async getDashboardLayout(id: number): Promise<MetabaseDashboardLayout> {
        const dashboard = await this.request<{
            tabs?: { id: number; name: string }[];
            dashcards?: { id: number; card_id: number | null; dashboard_tab_id: number | null }[];
        }>('GET', `/api/dashboard/${id}`);

        return {
            tabs: dashboard.tabs ?? [],
            cards: (dashboard.dashcards ?? []).map(dashcard => ({ id: dashcard.id, cardId: dashcard.card_id, tabId: dashcard.dashboard_tab_id })),
        };
    }

    /**
     * Lay out a dashboard: its tabs, its filters and which card sits where. Metabase replaces the
     * whole set of tabs and cards with what is sent, so this is also what removes a card the report
     * no longer has.
     */
    async updateDashboard(id: number, body: { name: string; description?: string; parameters: unknown[]; tabs: unknown[]; dashcards: unknown[]; collectionPosition?: number }): Promise<void> {
        await this.request('PUT', `/api/dashboard/${id}`, {
            name: body.name,
            description: body.description ?? null,
            parameters: body.parameters,
            tabs: body.tabs,
            dashcards: body.dashcards,
            // A position is what pins an item to the top of its collection; null leaves it unpinned.
            collection_position: body.collectionPosition ?? null,
        });
    }

    /**
     * Bookmark the dashboard, so it shows up under "Bookmarks" in the sidebar.
     *
     * A bookmark belongs to one account — the one the CLI signs in as — so this does nothing for
     * anyone else who opens Metabase. Bookmarking twice is an error, hence the check first.
     */
    async bookmarkDashboard(id: number): Promise<{ created: boolean }> {
        const bookmarks = await this.request<{ type?: string; item_id?: number }[]>('GET', '/api/bookmark');
        if (bookmarks.some(bookmark => bookmark.type === 'dashboard' && bookmark.item_id === id)) {
            return { created: false };
        }

        await this.request('POST', `/api/bookmark/dashboard/${id}`);
        return { created: true };
    }

    /** Move a question to the trash. */
    async archiveCard(id: number): Promise<void> {
        await this.request('PUT', `/api/card/${id}`, { archived: true });
    }

    /** Move a dashboard to the trash. Used to clear away the one-dashboard-per-page layout. */
    async archiveDashboard(id: number): Promise<void> {
        await this.request('PUT', `/api/dashboard/${id}`, { archived: true });
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
                ...(this.session ? { 'X-Metabase-Session': this.session } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(60_000),
        });

        const text = await response.text();
        if (!response.ok) {
            throw new MetabaseApiError(`${method} ${path} failed with status ${response.status}: ${text.slice(0, 200)}`, response.status);
        }

        return (text.length === 0 ? undefined : JSON.parse(text)) as T;
    }
}
