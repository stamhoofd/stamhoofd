import { clientIPFromForwardedFor, getIPVersion, IPRange, IPRangeSet, ipToBigInt, normalizeIP } from './IPRange.js';

describe('IPRange', () => {
    describe('getIPVersion', () => {
        test('detects IPv4 and IPv6', () => {
            expect(getIPVersion('1.2.3.4')).toBe(4);
            expect(getIPVersion('2a02:578::1')).toBe(6);
        });

        test('throws on invalid input', () => {
            expect(() => getIPVersion('not-an-ip')).toThrow();
        });
    });

    describe('clientIPFromForwardedFor', () => {
        test('returns a single IP unchanged', () => {
            expect(clientIPFromForwardedFor('1.2.3.4')).toBe('1.2.3.4');
            expect(clientIPFromForwardedFor('2a02:578::1')).toBe('2a02:578::1');
        });

        test('takes the left-most entry of an X-Forwarded-For chain', () => {
            expect(clientIPFromForwardedFor('1.2.3.4, 10.0.0.4')).toBe('1.2.3.4');
            expect(clientIPFromForwardedFor('1.2.3.4, 10.0.0.4, 10.0.0.3')).toBe('1.2.3.4');
        });

        test('trims surrounding whitespace', () => {
            expect(clientIPFromForwardedFor('  1.2.3.4 , 10.0.0.4')).toBe('1.2.3.4');
        });
    });

    describe('normalizeIP', () => {
        test('unwraps IPv4-mapped IPv6 addresses to plain IPv4', () => {
            expect(normalizeIP('::ffff:1.2.3.4')).toBe('1.2.3.4');
            expect(normalizeIP('::FFFF:127.0.0.1')).toBe('127.0.0.1');
            expect(normalizeIP('  ::ffff:8.8.8.8  ')).toBe('8.8.8.8');
        });

        test('leaves plain IPv4 and IPv6 untouched', () => {
            expect(normalizeIP('1.2.3.4')).toBe('1.2.3.4');
            expect(normalizeIP('2a02:578::1')).toBe('2a02:578::1');
        });
    });

    describe('ipToBigInt', () => {
        test('parses IPv4', () => {
            expect(ipToBigInt('0.0.0.0')).toEqual({ version: 4, value: 0n });
            expect(ipToBigInt('255.255.255.255')).toEqual({ version: 4, value: (1n << 32n) - 1n });
            expect(ipToBigInt('1.2.3.4').value).toBe((1n << 24n) + (2n << 16n) + (3n << 8n) + 4n);
        });

        test('treats an IPv4-mapped IPv6 address as IPv4', () => {
            expect(ipToBigInt('::ffff:1.2.3.4')).toEqual(ipToBigInt('1.2.3.4'));
        });

        test('parses compressed IPv6', () => {
            expect(ipToBigInt('::1')).toEqual({ version: 6, value: 1n });
            expect(ipToBigInt('::')).toEqual({ version: 6, value: 0n });
        });

        test('rejects out-of-range IPv4 octets', () => {
            expect(() => ipToBigInt('256.0.0.1')).toThrow();
            expect(() => ipToBigInt('1.2.3')).toThrow();
        });
    });

    describe('single address', () => {
        test('matches only itself', () => {
            const range = new IPRange('185.115.216.1');
            expect(range.includesIP('185.115.216.1')).toBe(true);
            expect(range.includesIP('185.115.216.2')).toBe(false);
            expect(range.includesIP('185.115.216.0')).toBe(false);
        });

        test('matches a single IPv6 address', () => {
            const range = new IPRange('2a02:578::1');
            expect(range.includesIP('2a02:578::1')).toBe(true);
            expect(range.includesIP('2a02:578::2')).toBe(false);
        });
    });

    describe('CIDR', () => {
        test('matches IPv4 CIDR boundaries', () => {
            const range = new IPRange('10.0.0.0/24');
            expect(range.includesIP('10.0.0.0')).toBe(true);
            expect(range.includesIP('10.0.0.255')).toBe(true);
            expect(range.includesIP('10.0.1.0')).toBe(false);
            expect(range.includesIP('9.255.255.255')).toBe(false);
        });

        test('matches a /32 as a single address', () => {
            const range = new IPRange('4.144.182.50/32');
            expect(range.includesIP('4.144.182.50')).toBe(true);
            expect(range.includesIP('4.144.182.51')).toBe(false);
        });

        test('matches IPv6 CIDR', () => {
            const range = new IPRange('2a02:578::/32');
            expect(range.includesIP('2a02:578:04de:b562::1')).toBe(true);
            expect(range.includesIP('2a02:579::1')).toBe(false);
        });

        test('rejects invalid prefixes', () => {
            expect(() => new IPRange('10.0.0.0/33')).toThrow();
            expect(() => new IPRange('10.0.0.0/-1')).toThrow();
        });
    });

    describe('explicit range', () => {
        test('matches inclusive start-end range', () => {
            const range = new IPRange('57.233.0.0-57.233.0.255');
            expect(range.includesIP('57.233.0.0')).toBe(true);
            expect(range.includesIP('57.233.0.1')).toBe(true);
            expect(range.includesIP('57.233.0.255')).toBe(true);
            expect(range.includesIP('57.233.1.0')).toBe(false);
        });

        test('rejects reversed and mixed-version ranges', () => {
            expect(() => new IPRange('57.233.0.255-57.233.0.0')).toThrow();
            expect(() => new IPRange('1.2.3.4-2a02:578::1')).toThrow();
        });
    });

    describe('version isolation', () => {
        test('an IPv4 range never matches an IPv6 address and vice versa', () => {
            const v4 = new IPRange('0.0.0.0/0');
            expect(v4.includesIP('::1')).toBe(false);

            const v6 = new IPRange('::/0');
            expect(v6.includesIP('1.2.3.4')).toBe(false);
        });

        test('an IPv4-mapped IPv6 client matches an IPv4 range', () => {
            const range = new IPRange('1.2.3.0/24');
            expect(range.includesIP('::ffff:1.2.3.4')).toBe(true);
            expect(range.includesIP('::ffff:1.2.4.4')).toBe(false);
        });
    });
});

describe('IPRangeSet', () => {
    const set = new IPRangeSet();

    beforeAll(() => {
        set.addLine('1.0.0.1');
        set.addLine('1.7.225.0/24');
        set.addLine('57.233.0.0-57.233.0.255');
        set.addLine('2a02:578::/32');
    });

    test('tracks its size', () => {
        expect(set.size).toBe(4);
    });

    test('matches across notations and versions', () => {
        expect(set.includes('1.0.0.1')).toBe(true);
        expect(set.includes('1.7.225.128')).toBe(true);
        expect(set.includes('57.233.0.42')).toBe(true);
        expect(set.includes('2a02:578:04de::1')).toBe(true);
    });

    test('rejects addresses outside every range', () => {
        expect(set.includes('8.8.8.8')).toBe(false);
        expect(set.includes('2a03:578::1')).toBe(false);
    });

    test('treats unparseable input as not included', () => {
        expect(set.includes('?')).toBe(false);
        expect(set.includes('not-an-ip')).toBe(false);
    });

    test('clear empties the set', () => {
        const other = new IPRangeSet();
        other.addLine('1.2.3.4');
        expect(other.includes('1.2.3.4')).toBe(true);
        other.clear();
        expect(other.size).toBe(0);
        expect(other.includes('1.2.3.4')).toBe(false);
    });

    describe('addText', () => {
        test('parses a list, skipping blanks and # comments', () => {
            const other = new IPRangeSet();
            other.addText('# a comment\n1.2.3.4\n\n10.0.0.0/8\n  \n');
            expect(other.size).toBe(2);
            expect(other.includes('1.2.3.4')).toBe(true);
            expect(other.includes('10.1.1.1')).toBe(true);
        });

        test('skips unparseable lines and reports them via onError', () => {
            const other = new IPRangeSet();
            const errors: string[] = [];
            other.addText('1.2.3.4\nnot-an-ip\n10.0.0.0/8', line => errors.push(line));
            expect(other.size).toBe(2);
            expect(errors).toEqual(['not-an-ip']);
        });
    });
});
