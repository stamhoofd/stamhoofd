import { expect, test } from 'vitest';
import { readJudicialRecordExtractUrl } from './judicialRecordExtractUrl';

const url = 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS';

test('Reads the link FOD Justitie prints on an extract', () => {
    expect(readJudicialRecordExtractUrl(url)).toBe(url);
});

test('Drops the whitespace a QR reader or a clipboard brings along', () => {
    expect(readJudicialRecordExtractUrl(`  ${url}\n`)).toBe(url);
});

test('Refuses a link that only contains the right one', () => {
    expect(readJudicialRecordExtractUrl(`${url}?redirect=evil`)).toBeNull();
    expect(readJudicialRecordExtractUrl(`https://example.com/?u=${url}`)).toBeNull();
});

test('Refuses another host, another scheme and another path', () => {
    expect(readJudicialRecordExtractUrl(url.replace('just.fgov.be', 'just.fgov.be.example.com'))).toBeNull();
    expect(readJudicialRecordExtractUrl(url.replace('https://', 'http://'))).toBeNull();
    expect(readJudicialRecordExtractUrl(url.replace('/record/', '/records/'))).toBeNull();
});

test('Refuses anything but a lowercase uuid followed by CJCS', () => {
    expect(readJudicialRecordExtractUrl(url.toUpperCase())).toBeNull();
    expect(readJudicialRecordExtractUrl(url.replace('2331f637', '2331F637'))).toBeNull();
    expect(readJudicialRecordExtractUrl(url.replace('-CJCS', ''))).toBeNull();
    expect(readJudicialRecordExtractUrl(url.replace('2331f637-', ''))).toBeNull();
});

test('Refuses an empty value', () => {
    expect(readJudicialRecordExtractUrl('')).toBeNull();
    expect(readJudicialRecordExtractUrl('   ')).toBeNull();
});
