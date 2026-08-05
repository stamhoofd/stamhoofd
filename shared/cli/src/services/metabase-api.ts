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
    async ensureDatabase(input: MetabaseDatabaseInput): Promise<{ created: boolean }> {
        const existing = await this.listDatabases();
        if (existing.some(database => database.name === input.name)) {
            return { created: false };
        }

        await this.request('POST', '/api/database', {
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
        return { created: true };
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
