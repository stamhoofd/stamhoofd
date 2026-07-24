/**
 * Pure IPv4/IPv6 address and range matching helpers.
 *
 * Supports three notations per entry:
 *  - a single address:        "185.115.216.1" or "2a02:578::1"
 *  - a CIDR range:            "1.7.225.0/24"  or "2a02:578::/32"
 *  - an explicit range:       "57.233.0.0-57.233.0.255"
 *
 * All matching is done on the integer value of the address (a bigint), so IPv6
 * is handled with the same code path as IPv4.
 */

export type IPVersion = 4 | 6;

export function getIPVersion(ip: string): IPVersion {
    if (ip.includes(':')) {
        return 6;
    }

    if (ip.includes('.')) {
        return 4;
    }

    throw new Error(`Invalid IP address: ${ip}`);
}

function ipv4ToBigInt(ip: string): bigint {
    const parts = ip.split('.');

    if (parts.length !== 4) {
        throw new Error(`Invalid IPv4 address: ${ip}`);
    }

    let result = 0n;

    for (const part of parts) {
        const value = Number(part);

        if (!Number.isInteger(value) || value < 0 || value > 255) {
            throw new Error(`Invalid IPv4 address: ${ip}`);
        }

        result = (result << 8n) + BigInt(value);
    }

    return result;
}

function ipv6ToBigInt(ip: string): bigint {
    if (ip.includes(':::')) {
        throw new Error(`Invalid IPv6 address: ${ip}`);
    }

    const [leftRaw, rightRaw] = ip.split('::');

    if (ip.split('::').length > 2) {
        throw new Error(`Invalid IPv6 address: ${ip}`);
    }

    const left = leftRaw ? leftRaw.split(':') : [];
    const right = rightRaw ? rightRaw.split(':') : [];

    const missing = 8 - left.length - right.length;

    if (missing < 0) {
        throw new Error(`Invalid IPv6 address: ${ip}`);
    }

    const groups: string[] = [
        ...left,
        ...Array(missing).fill('0'),
        ...right,
    ];

    if (groups.length !== 8) {
        throw new Error(`Invalid IPv6 address: ${ip}`);
    }

    let result = 0n;

    for (const group of groups) {
        if (!/^[0-9a-f]{1,4}$/i.test(group)) {
            throw new Error(`Invalid IPv6 address: ${ip}`);
        }

        result = (result << 16n) + BigInt(parseInt(group, 16));
    }

    return result;
}

/**
 * Node's dual-stack sockets report IPv4 clients as IPv4-mapped IPv6 addresses (e.g.
 * "::ffff:1.2.3.4"), and proxies may forward them in that form too. Normalize those back to
 * their plain IPv4 form so they match IPv4 ranges instead of failing to parse.
 */
export function normalizeIP(ip: string): string {
    const trimmed = ip.trim();
    const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(trimmed);
    return mapped ? mapped[1] : trimmed;
}

/**
 * Extract the originating client IP from a value that may be an `X-Forwarded-For` chain
 * (`"client, proxy1, proxy2"`). A reverse proxy that trusts its upstreams (e.g. Caddy with
 * `trusted_proxies`) appends each hop, and sanitizes forged headers at the edge, so the left-most
 * entry is the original client. A plain single IP (or anything without a comma) passes through
 * unchanged.
 */
export function clientIPFromForwardedFor(value: string): string {
    const first = value.split(',')[0];
    return (first ?? value).trim();
}

export function ipToBigInt(ip: string): { version: IPVersion; value: bigint } {
    const normalized = normalizeIP(ip);
    const version = getIPVersion(normalized);

    return {
        version,
        value: version === 4 ? ipv4ToBigInt(normalized) : ipv6ToBigInt(normalized),
    };
}

function parseCIDR(cidr: string): {
    version: IPVersion;
    start: bigint;
    end: bigint;
} {
    const [ip, prefixRaw] = cidr.trim().split('/');

    if (!ip || prefixRaw === undefined) {
        throw new Error(`Invalid CIDR range: ${cidr}`);
    }

    const { version, value } = ipToBigInt(ip);
    const bits = version === 4 ? 32 : 128;
    const prefix = Number(prefixRaw);

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) {
        throw new Error(`Invalid CIDR prefix: ${cidr}`);
    }

    const hostBits = BigInt(bits - prefix);
    const size = 1n << hostBits;
    const start = (value / size) * size;
    const end = start + size - 1n;

    return {
        version,
        start,
        end,
    };
}

function parseRange(range: string): {
    version: IPVersion;
    start: bigint;
    end: bigint;
} {
    const trimmed = range.trim();

    if (trimmed.includes('/')) {
        return parseCIDR(trimmed);
    }

    // Explicit "start-end" range (only IPv4/IPv6 addresses, which never contain a hyphen themselves)
    if (trimmed.includes('-')) {
        const [startRaw, endRaw] = trimmed.split('-');

        if (!startRaw || !endRaw || trimmed.split('-').length !== 2) {
            throw new Error(`Invalid IP range: ${range}`);
        }

        const start = ipToBigInt(startRaw.trim());
        const end = ipToBigInt(endRaw.trim());

        if (start.version !== end.version) {
            throw new Error(`Invalid mixed IP range: ${range}`);
        }

        if (start.value > end.value) {
            throw new Error(`Invalid reversed IP range: ${range}`);
        }

        return {
            version: start.version,
            start: start.value,
            end: end.value,
        };
    }

    // A single address: a range that only contains itself.
    const { version, value } = ipToBigInt(trimmed);

    return {
        version,
        start: value,
        end: value,
    };
}

export class IPRange {
    version: IPVersion;
    start: bigint;
    end: bigint;

    constructor(range: string) {
        const parsed = parseRange(range);

        this.version = parsed.version;
        this.start = parsed.start;
        this.end = parsed.end;
    }

    includes(version: IPVersion, value: bigint): boolean {
        return this.version === version && this.start <= value && value <= this.end;
    }

    includesIP(ip: string): boolean {
        const { version, value } = ipToBigInt(ip);
        return this.includes(version, value);
    }
}

/**
 * A collection of IP ranges, indexed by IP version, that can be queried for membership.
 *
 * Membership is a linear scan over the ranges of the matching version. This is intentionally
 * simple: the sets we use it for are queried at low request rates, so the O(n) scan is cheap
 * enough (a few tens of thousands of bigint comparisons at most).
 */
export class IPRangeSet {
    private ranges: Record<IPVersion, IPRange[]> = { 4: [], 6: [] };

    get size(): number {
        return this.ranges[4].length + this.ranges[6].length;
    }

    clear(): void {
        this.ranges = { 4: [], 6: [] };
    }

    add(range: IPRange): void {
        this.ranges[range.version].push(range);
    }

    /**
     * Parse a single line ("ip", "ip/prefix" or "start-end") and add it. Throws on invalid input.
     */
    addLine(line: string): void {
        this.add(new IPRange(line));
    }

    /**
     * Parse a whole list (one entry per line) and add every valid entry. Blank lines and lines
     * starting with '#' are ignored; unparseable lines are skipped and passed to onError (if given).
     */
    addText(text: string, onError?: (line: string, error: unknown) => void): void {
        for (const rawLine of text.split('\n')) {
            const line = rawLine.trim();

            if (!line || line.startsWith('#')) {
                continue;
            }

            try {
                this.addLine(line);
            } catch (error) {
                onError?.(line, error);
            }
        }
    }

    /**
     * Returns whether the given IP falls within any of the ranges. Invalid/unparseable IPs
     * are treated as not included (returns false) rather than throwing.
     */
    includes(ip: string): boolean {
        let parsed: { version: IPVersion; value: bigint };

        try {
            parsed = ipToBigInt(ip);
        } catch {
            return false;
        }

        for (const range of this.ranges[parsed.version]) {
            if (range.includes(parsed.version, parsed.value)) {
                return true;
            }
        }

        return false;
    }
}
