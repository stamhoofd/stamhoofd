import { readJudicialRecordExtractUrl } from '../src/judicialRecordExtractUrl.js';

const URL = 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS';

describe('readJudicialRecordExtractUrl', () => {
    test('accepts the form FOD Justitie prints', () => {
        expect(readJudicialRecordExtractUrl(URL)).toBe(URL);
    });

    test('drops whitespace a scanner or a clipboard brought along', () => {
        expect(readJudicialRecordExtractUrl(`  ${URL}  `)).toBe(URL);
        expect(readJudicialRecordExtractUrl(`${URL}\n`)).toBe(URL);
    });

    test('rejects a second line hiding behind a trailing newline', () => {
        // The trap this function exists for: `$` matches before a trailing newline, so matching
        // alone would accept this and hand a caller a value it did not check the whole of.
        expect(readJudicialRecordExtractUrl(`${URL}\nhttps://evil.example`)).toBeNull();
    });

    test('rejects a uuid that is not the lowercase form', () => {
        expect(readJudicialRecordExtractUrl(URL.toUpperCase())).toBeNull();
        expect(readJudicialRecordExtractUrl(URL.replace('2331f637', '2331F637'))).toBeNull();
    });

    test('rejects any host but theirs', () => {
        expect(readJudicialRecordExtractUrl(URL.replace('just.fgov.be', 'just.fgov.be.evil.example'))).toBeNull();
        expect(readJudicialRecordExtractUrl(URL.replace('just-crimeviewer-ctz', 'just-crimeviewer-ctz.evil'))).toBeNull();
        expect(readJudicialRecordExtractUrl(URL.replace('https://just-crimeviewer-ctz.just.fgov.be', 'https://127.0.0.1'))).toBeNull();
    });

    test('rejects a scheme that is not https', () => {
        expect(readJudicialRecordExtractUrl(URL.replace('https://', 'http://'))).toBeNull();
        expect(readJudicialRecordExtractUrl(URL.replace('https://', 'javascript:https://'))).toBeNull();
    });

    test('rejects anything appended to the path', () => {
        expect(readJudicialRecordExtractUrl(`${URL}?x=1`)).toBeNull();
        expect(readJudicialRecordExtractUrl(`${URL}#x`)).toBeNull();
        expect(readJudicialRecordExtractUrl(`${URL}/`)).toBeNull();
        expect(readJudicialRecordExtractUrl(URL.replace('-CJCS', '-CJCSX'))).toBeNull();
    });

    test('rejects credentials smuggled in front of the host', () => {
        expect(readJudicialRecordExtractUrl(URL.replace('https://', 'https://just-crimeviewer-ctz.just.fgov.be@evil.example/'))).toBeNull();
    });

    test('rejects a uuid that is not a uuid', () => {
        expect(readJudicialRecordExtractUrl(URL.replace('2331f637-9f30-46bd-9a3f-be62ff76d7dc', 'nope'))).toBeNull();
    });
});
