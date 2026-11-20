import { isSimpleError, isSimpleErrors } from '@common/errors';
import { ObjectData } from '@common/encoding';

import {
    DataRetentionCategory,
    DataRetentionPolicy,
    DataRetentionTerms,
    formatDataRetentionMonths,
    getDataRetentionConflicts,
    getDataRetentionSourceDescription,
    getDataRetentionTermsSummary,
    isEarlierDataRetentionDeletion,
    resolveDataRetentionTerms,
} from '#/index.ts';
import { Version } from '#/Version.ts';

const now = new Date('2026-06-01T12:00:00.000Z');

function policy(terms: {
    anonymizeAfterMonths?: number | null;
    deleteAfterMonths?: number | null;
    protectedPeriods?: number | null;
}) {
    return DataRetentionPolicy.create({
        category: DataRetentionCategory.Members,
        terms: DataRetentionTerms.create(terms),
    });
}

function getInvalidFields(
    category: DataRetentionCategory,
    terms: {
        anonymizeAfterMonths?: number | null;
        deleteAfterMonths?: number | null;
        protectedPeriods?: number | null;
    },
): string[] {
    try {
        DataRetentionTerms.create(terms).validate(category);
        return [];
    } catch (e) {
        if (isSimpleErrors(e)) {
            return e.errors.map((error) => error.field ?? '');
        }
        if (isSimpleError(e)) {
            return [e.field ?? ''];
        }
        throw e;
    }
}

describe('DataRetention', () => {
    describe('resolveDataRetentionTerms', () => {
        test.each([
            { platform: 24, organization: null, expected: 24 },
            { platform: 24, organization: 60, expected: 60 },
            { platform: 24, organization: 12, expected: 24 },
            { platform: null, organization: 12, expected: 12 },
            { platform: null, organization: null, expected: null },
        ])(
            'The longest term applies: platform $platform, organization $organization',
            ({ platform, organization, expected }) => {
                const anonymize = resolveDataRetentionTerms(
                    policy({ anonymizeAfterMonths: platform }),
                    policy({ anonymizeAfterMonths: organization }),
                    now,
                );
                expect(anonymize.anonymizeAfterMonths).toBe(expected);

                const deletion = resolveDataRetentionTerms(
                    policy({ deleteAfterMonths: platform }),
                    policy({ deleteAfterMonths: organization }),
                    now,
                );
                expect(deletion.deleteAfterMonths).toBe(expected);
            },
        );

        test('Actions are resolved separately', () => {
            const resolved = resolveDataRetentionTerms(
                policy({ anonymizeAfterMonths: 6, deleteAfterMonths: 60 }),
                policy({ anonymizeAfterMonths: 24, deleteAfterMonths: 36 }),
                now,
            );
            expect(resolved).toEqual({
                anonymizeAfterMonths: 24,
                deleteAfterMonths: 60,
                protectedPeriods: null,
                deleteExtendedByAnonymize: false,
            });
        });

        test('It works without policies', () => {
            expect(resolveDataRetentionTerms(null, null, now)).toEqual({
                anonymizeAfterMonths: null,
                deleteAfterMonths: null,
                protectedPeriods: null,
                deleteExtendedByAnonymize: false,
            });
            expect(
                resolveDataRetentionTerms(null, policy({ deleteAfterMonths: 12 }), now)
                    .deleteAfterMonths,
            ).toBe(12);
        });

        test.each([
            {
                name: 'organization anonymizes later',
                platform: { deleteAfterMonths: 36 },
                organization: { anonymizeAfterMonths: 60 },
            },
            {
                name: 'platform anonymizes later',
                platform: { anonymizeAfterMonths: 60 },
                organization: { anonymizeAfterMonths: 24, deleteAfterMonths: 36 },
            },
        ])(
            'Deleting waits for anonymizing when the levels conflict: $name',
            ({ platform, organization }) => {
                const resolved = resolveDataRetentionTerms(
                    policy(platform),
                    policy(organization),
                    now,
                );
                expect(resolved.anonymizeAfterMonths).toBe(60);
                expect(resolved.deleteAfterMonths).toBe(60);
                expect(resolved.deleteExtendedByAnonymize).toBe(true);
            },
        );

        test('Anonymizing without any delete term does not create a delete term', () => {
            const resolved = resolveDataRetentionTerms(
                policy({ anonymizeAfterMonths: 60 }),
                null,
                now,
            );
            expect(resolved.deleteAfterMonths).toBeNull();
            expect(resolved.deleteExtendedByAnonymize).toBe(false);
        });

        test.each([
            { platform: 2, organization: null, expected: 2 },
            { platform: 2, organization: 1, expected: 2 },
            { platform: 2, organization: 4, expected: 4 },
            { platform: null, organization: 1, expected: 1 },
            { platform: null, organization: null, expected: null },
        ])(
            'The highest number of protected periods applies: platform $platform, organization $organization',
            ({ platform, organization, expected }) => {
                const resolved = resolveDataRetentionTerms(
                    policy({ protectedPeriods: platform }),
                    policy({ protectedPeriods: organization }),
                    now,
                );
                expect(resolved.protectedPeriods).toBe(expected);
            },
        );

        test('Pending terms only apply from pendingFrom onwards', () => {
            const pending = DataRetentionPolicy.create({
                category: DataRetentionCategory.Members,
                terms: DataRetentionTerms.create({ anonymizeAfterMonths: 24 }),
                pendingTerms: DataRetentionTerms.create({ anonymizeAfterMonths: 6 }),
                pendingFrom: now,
            });

            expect(
                resolveDataRetentionTerms(pending, null, new Date(now.getTime() - 1))
                    .anonymizeAfterMonths,
            ).toBe(24);
            expect(resolveDataRetentionTerms(pending, null, now).anonymizeAfterMonths).toBe(6);
        });
    });

    describe('createDefault', () => {
        test('Only the top level protects periods by default, and only for members', () => {
            expect(
                DataRetentionPolicy.createDefault(DataRetentionCategory.Members, {
                    isTopLevel: true,
                }).terms.protectedPeriods,
            ).toBe(2);
            expect(
                DataRetentionPolicy.createDefault(DataRetentionCategory.Members, {
                    isTopLevel: false,
                }).terms.protectedPeriods,
            ).toBeNull();
            expect(
                DataRetentionPolicy.createDefault(DataRetentionCategory.Orders, {
                    isTopLevel: true,
                }).terms.protectedPeriods,
            ).toBeNull();
        });

        test('The default never sets a term', () => {
            const terms = DataRetentionPolicy.createDefault(DataRetentionCategory.Members, {
                isTopLevel: true,
            }).terms;
            expect(terms.anonymizeAfterMonths).toBeNull();
            expect(terms.deleteAfterMonths).toBeNull();
        });
    });

    describe('isEarlierDataRetentionDeletion', () => {
        const empty = {
            anonymizeAfterMonths: null,
            deleteAfterMonths: null,
            protectedPeriods: null,
        };

        test.each([
            { name: 'first term', before: {}, after: { deleteAfterMonths: 24 }, expected: true },
            {
                name: 'shorter term',
                before: { deleteAfterMonths: 24 },
                after: { deleteAfterMonths: 12 },
                expected: true,
            },
            {
                name: 'shorter anonymize term',
                before: { anonymizeAfterMonths: 24 },
                after: { anonymizeAfterMonths: 12 },
                expected: true,
            },
            {
                name: 'longer term',
                before: { deleteAfterMonths: 12 },
                after: { deleteAfterMonths: 24 },
                expected: false,
            },
            {
                name: 'same term',
                before: { deleteAfterMonths: 12 },
                after: { deleteAfterMonths: 12 },
                expected: false,
            },
            { name: 'removed term', before: { deleteAfterMonths: 12 }, after: {}, expected: false },
            {
                name: 'fewer protected periods',
                before: { protectedPeriods: 2 },
                after: { protectedPeriods: 1 },
                expected: true,
            },
            {
                name: 'protection turned off',
                before: { protectedPeriods: 2 },
                after: {},
                expected: true,
            },
            {
                name: 'more protected periods',
                before: { protectedPeriods: 1 },
                after: { protectedPeriods: 2 },
                expected: false,
            },
            {
                name: 'protection turned on',
                before: {},
                after: { protectedPeriods: 2 },
                expected: false,
            },
        ])('$name: $expected', ({ before, after, expected }) => {
            expect(
                isEarlierDataRetentionDeletion({ ...empty, ...before }, { ...empty, ...after }),
            ).toBe(expected);
        });

        test('A platform that removes a term waits, because a shorter organization term can start to apply', () => {
            expect(
                isEarlierDataRetentionDeletion({ ...empty, deleteAfterMonths: 12 }, empty, {
                    removedTermIsEarlier: true,
                }),
            ).toBe(true);
            expect(
                isEarlierDataRetentionDeletion({ ...empty, anonymizeAfterMonths: 12 }, empty, {
                    removedTermIsEarlier: true,
                }),
            ).toBe(true);
            expect(
                isEarlierDataRetentionDeletion(empty, empty, { removedTermIsEarlier: true }),
            ).toBe(false);
        });

        test('An organization that removes its longer term waits when the platform has a shorter term', () => {
            const platform = policy({ deleteAfterMonths: 24 });
            const before = resolveDataRetentionTerms(
                platform,
                policy({ deleteAfterMonths: 60 }),
                now,
            );
            const after = resolveDataRetentionTerms(platform, policy({}), now);
            expect(isEarlierDataRetentionDeletion(before, after)).toBe(true);
        });

        test('An organization that sets a shorter term than the platform changes nothing', () => {
            const platform = policy({ deleteAfterMonths: 24 });
            const before = resolveDataRetentionTerms(platform, policy({}), now);
            const after = resolveDataRetentionTerms(
                platform,
                policy({ deleteAfterMonths: 12 }),
                now,
            );
            expect(isEarlierDataRetentionDeletion(before, after)).toBe(false);
        });

        test('Removing an anonymize term that delayed deleting waits', () => {
            const platform = policy({ deleteAfterMonths: 36 });
            const before = resolveDataRetentionTerms(
                platform,
                policy({ anonymizeAfterMonths: 60 }),
                now,
            );
            const after = resolveDataRetentionTerms(platform, policy({}), now);
            expect(isEarlierDataRetentionDeletion(before, after)).toBe(true);
        });
    });

    describe('validate', () => {
        test.each([
            { name: 'empty', terms: {} },
            { name: 'minimum term', terms: { anonymizeAfterMonths: 3 } },
            {
                name: 'same term for both actions',
                terms: { anonymizeAfterMonths: 12, deleteAfterMonths: 12 },
            },
            {
                name: 'delete after anonymize',
                terms: { anonymizeAfterMonths: 6, deleteAfterMonths: 12 },
            },
            { name: 'delete without anonymize', terms: { deleteAfterMonths: 3 } },
            { name: 'one protected period', terms: { protectedPeriods: 1 } },
            { name: 'maximum term', terms: { deleteAfterMonths: 240 } },
            { name: 'maximum protected periods', terms: { protectedPeriods: 20 } },
        ])('Accepts $name', ({ terms }) => {
            expect(getInvalidFields(DataRetentionCategory.Members, terms)).toEqual([]);
        });

        test.each([
            {
                name: 'negative anonymize term',
                terms: { anonymizeAfterMonths: -6 },
                field: 'anonymizeAfterMonths',
            },
            {
                name: 'negative delete term',
                terms: { deleteAfterMonths: -6 },
                field: 'deleteAfterMonths',
            },
            {
                name: 'negative protected periods',
                terms: { protectedPeriods: -1 },
                field: 'protectedPeriods',
            },
            { name: 'zero months', terms: { deleteAfterMonths: 0 }, field: 'deleteAfterMonths' },
            {
                name: 'zero protected periods',
                terms: { protectedPeriods: 0 },
                field: 'protectedPeriods',
            },
            {
                name: 'term below the minimum',
                terms: { anonymizeAfterMonths: 2 },
                field: 'anonymizeAfterMonths',
            },
            {
                name: 'term above the maximum',
                terms: { deleteAfterMonths: 241 },
                field: 'deleteAfterMonths',
            },
            {
                name: 'protected periods above the maximum',
                terms: { protectedPeriods: 21 },
                field: 'protectedPeriods',
            },
            { name: 'decimal term', terms: { deleteAfterMonths: 3.5 }, field: 'deleteAfterMonths' },
            {
                name: 'decimal protected periods',
                terms: { protectedPeriods: 1.5 },
                field: 'protectedPeriods',
            },
            {
                name: 'delete before anonymize',
                terms: { anonymizeAfterMonths: 24, deleteAfterMonths: 12 },
                field: 'deleteAfterMonths',
            },
        ])('Rejects $name', ({ terms, field }) => {
            expect(getInvalidFields(DataRetentionCategory.Members, terms)).toEqual([field]);
        });

        test.each([
            {
                category: DataRetentionCategory.Orders,
                terms: { deleteAfterMonths: 12 },
                field: 'deleteAfterMonths',
            },
            {
                category: DataRetentionCategory.Emails,
                terms: { anonymizeAfterMonths: 12 },
                field: 'anonymizeAfterMonths',
            },
            {
                category: DataRetentionCategory.SensitiveData,
                terms: { anonymizeAfterMonths: 12 },
                field: 'anonymizeAfterMonths',
            },
            {
                category: DataRetentionCategory.Documents,
                terms: { anonymizeAfterMonths: 12 },
                field: 'anonymizeAfterMonths',
            },
            {
                category: DataRetentionCategory.Accounts,
                terms: { anonymizeAfterMonths: 12 },
                field: 'anonymizeAfterMonths',
            },
            {
                category: DataRetentionCategory.AuditLogs,
                terms: { anonymizeAfterMonths: 12 },
                field: 'anonymizeAfterMonths',
            },
            {
                category: DataRetentionCategory.Orders,
                terms: { protectedPeriods: 2 },
                field: 'protectedPeriods',
            },
        ])('Rejects $field for $category', ({ category, terms, field }) => {
            expect(getInvalidFields(category, terms)).toEqual([field]);
        });

        test('Text is refused while decoding', () => {
            const data = new ObjectData(
                { anonymizeAfterMonths: '3abc', deleteAfterMonths: null, protectedPeriods: null },
                { version: Version },
            );
            expect(() => DataRetentionTerms.decode(data)).toThrow(/Expected a number/);
        });
    });

    describe('descriptions', () => {
        // The test environment returns keys without filling in placeholders: do that here, as I18n.replace does
        const original = (globalThis as any).$t;
        beforeAll(() => {
            (globalThis as any).$t = (key: string, replace?: Record<string, unknown>) =>
                Object.entries(replace ?? {}).reduce(
                    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
                    key,
                );
        });
        afterAll(() => {
            (globalThis as any).$t = original;
        });

        test('A term is shown in years when possible', () => {
            expect(formatDataRetentionMonths(12)).toBe('1 jaar');
            expect(formatDataRetentionMonths(60)).toBe('5 jaar');
            expect(formatDataRetentionMonths(18)).toBe('18 maanden');
            expect(formatDataRetentionMonths(3)).toBe('3 maanden');
        });

        test('The summary lists every action, or says that nothing is set', () => {
            expect(
                getDataRetentionTermsSummary({ anonymizeAfterMonths: 24, deleteAfterMonths: 60 }),
            ).toBe('Anonimiseren na 2 jaar · verwijderen na 5 jaar');
            expect(
                getDataRetentionTermsSummary({ anonymizeAfterMonths: null, deleteAfterMonths: 12 }),
            ).toBe('Verwijderen na 1 jaar');
            expect(
                getDataRetentionTermsSummary({
                    anonymizeAfterMonths: null,
                    deleteAfterMonths: null,
                }),
            ).toBe('Geen termijn: blijft bewaard');
        });

        test.each([
            {
                name: 'only the platform has a term',
                platform: { anonymizeAfterMonths: 24 },
                organization: {},
                expected: 'Termijn van de koepel. Jullie stelden niets in.',
            },
            {
                name: 'nobody has a term',
                platform: {},
                organization: {},
                expected: 'Jullie stelden niets in, en de koepel ook niet.',
            },
            {
                name: 'the organization keeps longer',
                platform: { anonymizeAfterMonths: 24 },
                organization: { anonymizeAfterMonths: 84 },
                expected: 'Jullie termijn. De langste termijn geldt.',
            },
            {
                name: 'the platform keeps longer',
                platform: { deleteAfterMonths: 36 },
                organization: { deleteAfterMonths: 12 },
                expected:
                    'De koepel bewaart langer, en de langste termijn geldt. Jullie kortere termijn geldt zodra de koepel die verkort.',
            },
        ])(
            'The source says whose term applies when $name',
            ({ platform, organization, expected }) => {
                expect(
                    getDataRetentionSourceDescription(policy(platform), policy(organization), now),
                ).toBe(expected);
            },
        );

        test('A shorter own term, a conflict between the levels and fewer protected periods are explained', () => {
            const conflicts = getDataRetentionConflicts(
                DataRetentionTerms.create({ anonymizeAfterMonths: 60, protectedPeriods: 2 }),
                DataRetentionTerms.create({
                    anonymizeAfterMonths: 24,
                    deleteAfterMonths: 36,
                    protectedPeriods: 1,
                }),
            );

            expect(conflicts).toEqual([
                'Koepel en vereniging samen zouden verwijderen voor er geanonimiseerd wordt. De langste termijn geldt, dus er wordt pas na 5 jaar verwijderd.',
                'De koepel bewaart langer (anonimiseren na 5 jaar). De langste termijn geldt, dus jullie kortere termijn heeft nu geen effect. Hij geldt zodra de koepel haar termijn verkort.',
                'De koepel beschermt de laatste 2 werkjaren. Het hoogste aantal geldt. Jullie aantal geldt zodra de koepel dat verlaagt.',
            ]);
        });

        test('There are no conflicts without a platform, or when the organization keeps longer', () => {
            expect(
                getDataRetentionConflicts(
                    null,
                    DataRetentionTerms.create({ deleteAfterMonths: 12 }),
                ),
            ).toEqual([]);
            expect(
                getDataRetentionConflicts(
                    DataRetentionTerms.create({ deleteAfterMonths: 12 }),
                    DataRetentionTerms.create({ deleteAfterMonths: 36 }),
                ),
            ).toEqual([]);
        });
    });
});
