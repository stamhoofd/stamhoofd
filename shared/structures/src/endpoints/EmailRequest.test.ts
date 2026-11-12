import { Language } from '@stamhoofd/types/Language';
import { EncodeMedium, ObjectData } from '@common/encoding';
import { File } from '../files/File.js';
import { getUsedReplacementFiles, Recipient, Replacement } from './EmailRequest.js';

describe('Recipient headers', () => {
    for (const version of [208, 209, 423]) {
        test(`preserves nullable header JSON and replacement patches at version ${version}`, () => {
            const context = { version, medium: EncodeMedium.Database };
            for (const headers of [
                undefined,
                null,
                {},
                { 'X-Custom': 'value' },
                { _isPatch: 'custom header' },
            ]) {
                const payload = { email: 'test@example.com', headers };
                const recipient = Recipient.decode(new ObjectData(payload, context));
                expect(recipient.headers).toEqual(
                    version < 209 || headers == null ? null : new Map(Object.entries(headers)),
                );
                const encoded = JSON.parse(JSON.stringify(recipient.encode(context)));
                if (version < 209) {
                    expect(encoded).not.toHaveProperty('headers');
                } else {
                    expect(encoded.headers ?? null).toEqual(headers ?? null);
                }
                const patch = Recipient.patchType().decode(new ObjectData({ headers }, context));
                const patched = Recipient.create({
                    email: payload.email,
                    headers: new Map([['old', 'value']]),
                }).patch(patch);
                if (version >= 209 && headers !== undefined) {
                    expect(patched.headers).toEqual(
                        headers === null ? null : new Map(Object.entries(headers)),
                    );
                }
            }
        });
    }

    test('clones header Maps independently and applies incremental changes', () => {
        const recipient = Recipient.create({
            email: 'test@example.com',
            headers: new Map([['old', 'value']]),
        });
        expect(recipient.clone().headers).toEqual(recipient.headers);
        expect(recipient.clone().headers).not.toBe(recipient.headers);
        const patch = Recipient.patch({});
        patch.headers!.set('old', null);
        patch.headers!.set('new', 'value');
        expect(recipient.patch(patch).headers).toEqual(new Map([['new', 'value']]));
    });
});

describe('Recipient.merge', () => {
    describe('language', () => {
        it('keeps its own language and ignores the incoming one when set', () => {
            const recipient = Recipient.create({
                email: 'test@example.com',
                language: Language.French,
            });
            recipient.merge(
                Recipient.create({ email: 'test@example.com', language: Language.Dutch }),
            );
            expect(recipient.language).toBe(Language.French);
        });

        it('takes the incoming language when its own is not set', () => {
            const recipient = Recipient.create({ email: 'test@example.com', language: null });
            recipient.merge(
                Recipient.create({ email: 'test@example.com', language: Language.Dutch }),
            );
            expect(recipient.language).toBe(Language.Dutch);
        });

        it('stays null when neither has a language', () => {
            const recipient = Recipient.create({ email: 'test@example.com', language: null });
            recipient.merge(Recipient.create({ email: 'test@example.com', language: null }));
            expect(recipient.language).toBeNull();
        });
    });
});

describe('Replacement.getHtmlForWebDisplay', () => {
    test('swaps inline image srcs for the file url', () => {
        const file = new File({
            id: 'image-1',
            server: 'https://files.example.com',
            path: 'users/1/abc/photo.jpg',
            size: 100,
            isPrivate: true,
            signature: 'signature',
            signedUrl: 'https://files.example.com/users/1/abc/photo.jpg?token=a&expires=b',
        });
        const replacement = Replacement.create({
            token: 'orderDetailsTable',
            html: '<img src="' + file.inlineEmailSrc + '">',
            files: [file],
        });

        // The signed url is used, escaped for use in an attribute
        expect(replacement.getHtmlForWebDisplay()).toBe(
            '<img src="https://files.example.com/users/1/abc/photo.jpg?token=a&amp;expires=b">',
        );

        // The html to send keeps referencing the attachment
        expect(replacement.html).toContain('cid:image-1');
    });

    test('leaves html without inline images untouched', () => {
        const replacement = Replacement.create({ token: 'a', html: '<table></table>' });
        expect(replacement.getHtmlForWebDisplay()).toBe('<table></table>');
        expect(
            Replacement.create({ token: 'b', value: 'B' }).getHtmlForWebDisplay(),
        ).toBeUndefined();
    });
});

describe('getUsedReplacementFiles', () => {
    function buildFile(data: { id: string; name?: string }) {
        return new File({
            id: data.id,
            server: 'https://files.example.com',
            path: 'files/' + data.id + '/document.pdf',
            size: 100,
            name: data.name ?? 'document.pdf',
        });
    }

    test('only returns files of replacements that are used in the html', () => {
        const usedFile = buildFile({ id: 'used' });
        const unusedFile = buildFile({ id: 'unused' });

        const files = getUsedReplacementFiles('<p>{{orderDetailsTable}}</p>', [
            Replacement.create({
                token: 'orderDetailsTable',
                html: '<table></table>',
                files: [usedFile],
            }),
            Replacement.create({
                token: 'otherTable',
                html: '<table></table>',
                files: [unusedFile],
            }),
        ]);

        expect(files).toEqual([usedFile]);
    });

    test('includes files of replacements inserted by another replacement', () => {
        const file = buildFile({ id: 'nested' });

        const files = getUsedReplacementFiles('<p>{{outer}}</p>', [
            Replacement.create({ token: 'inner', html: '<table></table>', files: [file] }),
            Replacement.create({ token: 'outer', html: '<div>{{inner}}</div>' }),
        ]);

        expect(files).toEqual([file]);
    });

    test('a file used multiple times is only returned once', () => {
        const file = buildFile({ id: 'duplicate' });

        const files = getUsedReplacementFiles('<p>{{a}} {{b}}</p>', [
            Replacement.create({ token: 'a', value: 'A', files: [file] }),
            Replacement.create({ token: 'b', value: 'B', files: [file] }),
        ]);

        expect(files).toEqual([file]);
    });

    test('returns nothing when no replacement has files', () => {
        const files = getUsedReplacementFiles('<p>{{a}}</p>', [
            Replacement.create({ token: 'a', value: 'A' }),
        ]);

        expect(files).toEqual([]);
    });
});
