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

export type MetabaseDashboard = {
    id: number;
    name: string;
};

export class MetabaseApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'MetabaseApiError';
    }
}

/**
 * Minimal client for the Metabase HTTP API, enough to complete the setup wizard and register the
 * databases Metabase reports on. Metabase has no declarative provisioning in the open source
 * edition (the config file is an enterprise feature), so this is the only way to automate it.
 */
export class MetabaseApi {
    private session: string | undefined;

    constructor(private readonly baseUrl: string) {
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

    async listDatabases(): Promise<MetabaseDatabase[]> {
        const result = await this.request<{ data: MetabaseDatabase[] } | MetabaseDatabase[]>('GET', '/api/database');
        return Array.isArray(result) ? result : result.data;
    }

    /**
     * Register `input` as a MySQL database unless a database with the same name is already
     * registered. An existing one is left untouched, so changes made in the UI survive.
     */
    async ensureDatabase(input: MetabaseDatabaseInput): Promise<{ id: number; created: boolean }> {
        const existing = await this.listDatabases();
        const match = existing.find(database => database.name === input.name);
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

    /**
     * The collection the report lives in, created if it is not there yet. Everything the CLI writes
     * goes in one collection so it stays apart from whatever the client builds themselves.
     */
    async ensureCollection(name: string): Promise<{ id: number; created: boolean }> {
        const collections = await this.request<MetabaseCollection[]>('GET', '/api/collection');
        const match = collections.find(collection => collection.name === name && collection.archived !== true);
        if (match) {
            return { id: match.id, created: false };
        }

        const created = await this.request<{ id: number }>('POST', '/api/collection', { name, parent_id: null });
        return { id: created.id, created: true };
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

    /** The tabs a dashboard already has, so writing it again can keep their ids. */
    async getDashboardTabs(id: number): Promise<{ id: number; name: string }[]> {
        const dashboard = await this.request<{ tabs?: { id: number; name: string }[] }>('GET', `/api/dashboard/${id}`);
        return dashboard.tabs ?? [];
    }

    /**
     * Lay out a dashboard: its tabs, its filters and which card sits where. Metabase replaces the
     * whole set of tabs and cards with what is sent, so this is also what removes a card the report
     * no longer has.
     */
    async updateDashboard(id: number, body: { name: string; description?: string; parameters: unknown[]; tabs: unknown[]; dashcards: unknown[] }): Promise<void> {
        await this.request('PUT', `/api/dashboard/${id}`, {
            name: body.name,
            description: body.description ?? null,
            parameters: body.parameters,
            tabs: body.tabs,
            dashcards: body.dashcards,
        });
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
