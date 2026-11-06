import { describe, expect, test } from 'vitest';

import { getCrlUrls, getOcspUrls } from '../src/CertificateUrls.js';
import { issueCertificate } from './helpers/RevocationFixtures.js';

async function ocspUrls(ocspUrl: string): Promise<string[]> {
    return getOcspUrls((await issueCertificate({ commonName: 'Signer', ocspUrl })).certificate);
}

async function crlUrls(crlUrl: string): Promise<string[]> {
    return getCrlUrls((await issueCertificate({ commonName: 'Signer', crlUrl })).certificate);
}

describe('the urls a certificate says to ask', () => {
    test('are read from the certificate', async () => {
        expect(await ocspUrls('http://ocsp.example.com/signing')).toEqual(['http://ocsp.example.com/signing']);
        expect(await crlUrls('https://crl.example.com/signing.crl')).toEqual(['https://crl.example.com/signing.crl']);
    });

    test('are none when the certificate names none', async () => {
        const silent = await issueCertificate({ commonName: 'Silent Signer' });

        expect(getOcspUrls(silent.certificate)).toEqual([]);
        expect(getCrlUrls(silent.certificate)).toEqual([]);
    });

    test.each([
        ['ldap://directory.example.com/cn=crl', 'a scheme we do not speak'],
        ['file:///etc/passwd', 'a scheme that is not a request at all'],
        ['not a url at all', 'something that does not parse'],
        ['http://127.0.0.1:8080/signing', 'a host written as an ipv4 address'],
        ['http://[::1]:8080/signing', 'a host written as an ipv6 address'],
        ['http://localhost:6379/signing', 'the name of this machine'],
        ['http://ocsp.localhost/signing', 'a name under it'],
        ['http://printer.local/signing', 'a name of this network'],
        ['http://metadata.internal/signing', 'a name reserved for one'],
        ['http://router.home.arpa/signing', 'another reserved for one'],
        ['http://intranet/signing', 'a bare name, which is one of this network'],
    ])('leave out %s: %s', async (url) => {
        expect(await ocspUrls(url)).toEqual([]);
        expect(await crlUrls(url)).toEqual([]);
    });
});
