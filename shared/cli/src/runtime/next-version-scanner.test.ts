import { describe, expect, it } from 'vitest';
import { readStructuresVersion, replaceNextVersion, writeStructuresVersion } from './next-version-scanner.js';

const replaceBy = 'version: 426';

describe('next-version-scanner', () => {
    describe('replaceNextVersion', () => {
        it('rewrites a field on a single line', () => {
            const source = `
class Example extends AutoEncoder {
    @field({ decoder: StringDecoder, ...NextVersion })
    name = '';
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(1);
            expect(result.content).toBe(source.replace('...NextVersion', replaceBy));
        });

        it('rewrites multi-line decorators and multiple fields', () => {
            const source = `
class Example extends AutoEncoder {
    @field({
        decoder: StringDecoder,
        nullable: true,
        ...NextVersion,
        upgrade: () => null,
    })
    first: string | null = null;

    @field({ decoder: BooleanDecoder, ...NextVersion })
    second = false;
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(2);
            expect(result.content).toBe(source.replaceAll('...NextVersion', replaceBy));
        });

        it('ignores line comments and code outside @field', () => {
            const source = `
// @field({ decoder: StringDecoder, ...NextVersion })
const options = { ...NextVersion };
class Example extends AutoEncoder {
    @field({ decoder: StringDecoder, ...NextVersion }) // ...NextVersion
    name = '';
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(1);
            expect(result.content).toBe(source.replace('    @field({ decoder: StringDecoder, ...NextVersion })', `    @field({ decoder: StringDecoder, ${replaceBy} })`));
        });

        it('only matches the options object passed directly to @field', () => {
            const source = '@field(TranslatedString.field({ ...NextVersion }))';
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(0);
            expect(result.content).toBe(source);
        });

        it('leaves files without NextVersion untouched', () => {
            const source = '@field({ decoder: StringDecoder, version: 12 })';
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(0);
            expect(result.content).toBe(source);
        });
    });

    describe('Version.ts', () => {
        it('reads and bumps the version', () => {
            const content = 'export const Version = 425;\n';
            expect(readStructuresVersion(content)).toBe(425);

            const bumped = writeStructuresVersion(content, 425, 426);
            expect(readStructuresVersion(bumped)).toBe(426);
        });

        it('fails when the version cannot be found', () => {
            expect(() => readStructuresVersion('export const Something = 425;')).toThrow();
            expect(() => readStructuresVersion('export const Version = 0;')).toThrow();
            expect(() => writeStructuresVersion('export const Version = 425;', 424, 425)).toThrow();
        });
    });
});
