import { SimpleError } from '@simonbackx/simple-errors';
import { IPRangeSet } from '@stamhoofd/utility/IPRange.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Guards the /prerender endpoint against being overloaded by (spam) bots by only allowing
 * requests from a whitelist of trusted IP addresses (legitimate crawlers, AI bots, monitoring, ...).
 *
 * The whitelist is fetched from a public, plain-text list and cached on disk. On boot and on every
 * refresh we try the remote source first and fall back to the local cache when it's unavailable, so
 * a transient outage never wipes the whitelist. If no list is available at all (neither remote nor
 * cache), the set stays empty and every request is blocked (fail-closed) — a state our monitoring
 * should alert on.
 *
 * The source URL defaults to {@link TrustedIPWhitelist.DEFAULT_URL} in real deployments (production
 * and staging) and can be overridden with PRERENDER_IP_WHITELIST_URL. In local development and tests
 * it's off by default and only enabled when PRERENDER_IP_WHITELIST_URL is explicitly set.
 */
export class TrustedIPWhitelist {
    static shared = new TrustedIPWhitelist();

    /**
     * Default trusted-IP source: the "all safe IPs" list (crawlers, AI bots, infrastructure,
     * monitoring and DNS resolvers) from https://github.com/sefinek/trusted-ips-whitelist.
     */
    static readonly DEFAULT_URL = 'https://raw.githubusercontent.com/sefinek/trusted-ips-whitelist/main/lists/all-safe-ips.txt';

    /** The upstream list is regenerated roughly every 6 hours. */
    static readonly REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
    /** While we have no list at all (fail-closed, blocking everything), retry much more often. */
    static readonly EMPTY_RETRY_INTERVAL_MS = 5 * 60 * 1000;
    static readonly FETCH_TIMEOUT_MS = 30 * 1000;
    static readonly CACHE_FILE_NAME = 'trusted-ips-whitelist.txt';

    private set = new IPRangeSet();
    private refreshTimer: NodeJS.Timeout | null = null;
    private autoRefreshActive = false;

    get enabled(): boolean {
        return !!this.url;
    }

    get url(): string | undefined {
        if (STAMHOOFD.PRERENDER_IP_WHITELIST_URL) {
            return STAMHOOFD.PRERENDER_IP_WHITELIST_URL;
        }

        // Enabled by default in real deployments; opt-in (via the env var) for local dev and tests.
        if (STAMHOOFD.environment === 'production' || STAMHOOFD.environment === 'staging') {
            return TrustedIPWhitelist.DEFAULT_URL;
        }

        return undefined;
    }

    /** Number of ranges currently loaded (for logging/monitoring/tests). */
    get count(): number {
        return this.set.size;
    }

    private get cacheFilePath(): string {
        return path.join(STAMHOOFD.CACHE_PATH, TrustedIPWhitelist.CACHE_FILE_NAME);
    }

    /**
     * Parse raw list text into a set of ranges. Lines that are empty or start with '#' are
     * ignored; unparseable lines are skipped (and logged).
     */
    private parse(text: string): IPRangeSet {
        const set = new IPRangeSet();
        set.addText(text, (line, error) => {
            console.error(`[trusted-ips] Failed to parse line: ${line}`, error);
        });
        return set;
    }

    /**
     * Replace the in-memory ranges from raw list text. Returns the number of parsed entries.
     */
    setFromText(text: string): number {
        this.set = this.parse(text);
        return this.set.size;
    }

    private async fetchRemote(): Promise<string> {
        const url = this.url;
        if (!url) {
            throw new Error('No PRERENDER_IP_WHITELIST_URL configured');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TrustedIPWhitelist.FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`Unexpected status ${response.status} while fetching ${url}`);
            }
            return await response.text();
        } finally {
            clearTimeout(timeout);
        }
    }

    private async readCache(): Promise<string | null> {
        try {
            return await fs.readFile(this.cacheFilePath, 'utf-8');
        } catch {
            return null;
        }
    }

    private async writeCache(text: string): Promise<void> {
        try {
            await fs.mkdir(STAMHOOFD.CACHE_PATH, { recursive: true });
            await fs.writeFile(this.cacheFilePath, text, 'utf-8');
        } catch (error) {
            console.error('[trusted-ips] Failed to persist whitelist cache', error);
        }
    }

    /**
     * Fetch the whitelist from the remote source and persist it locally. Falls back to the
     * locally cached copy when the remote fetch fails or returns an empty list, so a transient
     * outage doesn't drop the whitelist. Never throws: a failure just leaves the previous set
     * in place, or an empty set if nothing could be loaded.
     */
    async load(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        try {
            const text = await this.fetchRemote();
            const set = this.parse(text);

            if (set.size > 0) {
                // Only install and persist a valid, non-empty list.
                this.set = set;
                await this.writeCache(text);
                console.log(`[trusted-ips] Loaded ${set.size} trusted IP ranges from ${this.url}`);
                return;
            }

            console.error('[trusted-ips] Remote whitelist was empty, falling back to local cache');
        } catch (error) {
            console.error('[trusted-ips] Failed to fetch remote whitelist, falling back to local cache', error);
        }

        // Fall back to the last known good copy on disk. We keep the current in-memory set until
        // we have a valid replacement, so a failed refresh never blocks requests it was serving.
        const cached = await this.readCache();
        if (cached !== null) {
            const set = this.parse(cached);
            if (set.size > 0) {
                this.set = set;
                console.log(`[trusted-ips] Loaded ${set.size} trusted IP ranges from local cache`);
                return;
            }
        }

        // No usable list at all: block every request (fail-closed). Monitoring should alert on this.
        this.set = new IPRangeSet();
        console.error('[trusted-ips] No trusted IP whitelist available (remote and cache both failed). Prerender requests will be blocked.');
    }

    /**
     * Delay until the next background refresh. While we have a usable list we only need to keep up
     * with the upstream (regenerated ~every 6h); while we have nothing (fail-closed, blocking every
     * request) we retry much more often so a brief upstream outage doesn't blackhole prerendering.
     */
    private nextRefreshDelay(): number {
        return this.count > 0
            ? TrustedIPWhitelist.REFRESH_INTERVAL_MS
            : TrustedIPWhitelist.EMPTY_RETRY_INTERVAL_MS;
    }

    /** Periodically refresh the whitelist in the background. Safe to call multiple times. */
    startAutoRefresh(): void {
        if (!this.enabled || this.autoRefreshActive) {
            return;
        }

        this.autoRefreshActive = true;
        this.scheduleNextRefresh();
    }

    private scheduleNextRefresh(): void {
        if (!this.autoRefreshActive) {
            return;
        }

        this.refreshTimer = setTimeout(() => {
            // load() never rejects (it handles its own errors); reschedule once it settles.
            void this.load().finally(() => this.scheduleNextRefresh());
        }, this.nextRefreshDelay());

        // Don't keep the event loop alive just for refreshing.
        this.refreshTimer.unref?.();
    }

    stopAutoRefresh(): void {
        this.autoRefreshActive = false;
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    isWhitelisted(ip: string): boolean {
        return this.set.includes(ip);
    }

    /**
     * Throws a 403 when whitelisting is enabled and the IP is not allowed (including when the
     * whitelist could not be loaded). When disabled this is a no-op.
     */
    assertAllowed(ip: string): void {
        if (!this.enabled) {
            return;
        }

        if (!this.isWhitelisted(ip)) {
            throw new SimpleError({
                statusCode: 403,
                code: 'ip_not_whitelisted',
                message: `IP ${ip} is not in the trusted IP whitelist`,
            });
        }
    }
}
