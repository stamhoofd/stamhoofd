import type { Country } from '@stamhoofd/types/Country';
import fs from 'fs';
import readline from 'readline';

type IPVersion = 4 | 6;

function getIPVersion(ip: string): IPVersion {
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

    const groups = [
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

function ipToBigInt(ip: string): { version: IPVersion; value: bigint } {
    const version = getIPVersion(ip);

    return {
        version,
        value: version === 4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip),
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

class IPRange {
    version: IPVersion;
    start: bigint;
    end: bigint;
    carrier: string;

    constructor(cidr: string, carrier = '') {
        const parsed = parseRange(cidr);

        this.version = parsed.version;
        this.start = parsed.start;
        this.end = parsed.end;
        this.carrier = carrier;
    }

    includes(version: IPVersion, ip: bigint): boolean {
        return this.version === version && this.start <= ip && ip <= this.end;
    }
}

export class Geolocator {
    static shared = new Geolocator();

    ranges: Map<Country, IPRange[]> = new Map();

    async load(file: string, country: Country) {
        const lineReader = readline.createInterface({
            input: fs.createReadStream(file, { encoding: 'utf-8' }),
        });

        const ranges = this.ranges.get(country) ?? [];
        this.ranges.set(country, ranges);

        for await (const rawLine of lineReader) {
            const line = rawLine.trim();

            if (!line || line.startsWith('#')) {
                continue;
            }

            try {
                ranges.push(new IPRange(line));
            } catch (error) {
                console.error(`Failed to parse line: ${line}`, error);
            }
        }
    }

    getCountry(ip: string): Country | undefined {
        const parsed = ipToBigInt(ip);

        for (const [country, ranges] of this.ranges) {
            for (const range of ranges) {
                if (range.includes(parsed.version, parsed.value)) {
                    return country;
                }
            }
        }
    }
}
