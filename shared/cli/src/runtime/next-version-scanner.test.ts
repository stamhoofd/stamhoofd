import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { getProjectPath } from '../context/project-path.js';
import { readReleasedVersion, replaceNextVersion, writeReleasedVersion } from './next-version-scanner.js';

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

        it('rewrites the spread form', () => {
            const source = `
class Example extends AutoEncoder {
    @field({ decoder: StringDecoder })
    @field({ ...TranslatedString.field({}), ...NextVersion })
    name = new TranslatedString();
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(1);
            expect(result.content).toBe(source.replace('...NextVersion', replaceBy));
        });

        it('rewrites the helper-call form', () => {
            const source = `
class Example extends AutoEncoder {
    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ ...NextVersion }))
    name = new TranslatedString();
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(1);
            expect(result.content).toBe(source.replace('...NextVersion', replaceBy));
        });

        it('ignores block comments', () => {
            const source = `
/**
 * Use @field({ decoder: StringDecoder, ...NextVersion }) for new fields.
 */
class Example extends AutoEncoder {
    /* @field({ decoder: StringDecoder, ...NextVersion }) */
    @field({ decoder: StringDecoder, /* ...NextVersion */ ...NextVersion })
    name = '';
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(1);
            expect(result.content).toBe(source.replace('/* ...NextVersion */ ...NextVersion', `/* ...NextVersion */ ${replaceBy}`));
        });

        it('does not close a block comment on the opening /*/', () => {
            const source = `
/*/ @field({ decoder: StringDecoder, ...NextVersion }) */
@field({ decoder: StringDecoder, ...NextVersion })
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(1);
            expect(result.content).toBe(source.replace('\n@field({ decoder: StringDecoder, ...NextVersion })', `\n@field({ decoder: StringDecoder, ${replaceBy} })`));
        });

        it('ignores comment markers inside string literals', () => {
            const source = `
class Example extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => 'https://example.com', ...NextVersion })
    url = '';

    @field({ decoder: StringDecoder, defaultValue: () => "/* not a comment", ...NextVersion })
    second = '';

    @field({ decoder: StringDecoder, defaultValue: () => \`// \\\` still a string\`, ...NextVersion })
    third = '';

    @field({ decoder: StringDecoder, defaultValue: () => 'it\\'s // fine', ...NextVersion })
    fourth = '';
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(4);
            expect(result.content).toBe(source.replaceAll('...NextVersion', replaceBy));
        });

        it('does not rewrite NextVersion inside a string literal', () => {
            const source = `
class Example extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => '...NextVersion', ...NextVersion })
    name = '';
}
`;
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(1);
            expect(result.content).toBe(source.replace(', ...NextVersion })', `, ${replaceBy} })`));
        });

        it('leaves files without NextVersion untouched', () => {
            const source = '@field({ decoder: StringDecoder, version: 12 })';
            const result = replaceNextVersion(source, replaceBy);
            expect(result.replaced).toBe(0);
            expect(result.content).toBe(source);
        });
    });

    describe('Version.ts', () => {
        it('reads and bumps ReleasedVersion of the real file', async () => {
            const content = await readFile(`${getProjectPath()}shared/structures/src/Version.ts`, 'utf8');
            const released = readReleasedVersion(content);
            expect(released).toBeGreaterThan(0);

            const bumped = writeReleasedVersion(content, released, released + 1);
            expect(readReleasedVersion(bumped)).toBe(released + 1);
            expect(bumped).not.toContain(`Version = ${released};`);
        });

        it('fails when the version cannot be found', () => {
            expect(() => readReleasedVersion('export const Version = 425;')).toThrow();
            expect(() => readReleasedVersion('export const ReleasedVersion = 0;')).toThrow();
            expect(() => writeReleasedVersion('export const ReleasedVersion = 425;', 424, 425)).toThrow();
        });
    });
});
