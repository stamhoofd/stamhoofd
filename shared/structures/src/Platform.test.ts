import { ObjectData } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';
import { Formatter } from '@stamhoofd/utility';
import { Platform, PlatformConfig, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig } from './Platform.js';
import { RichText } from './RichText.js';
import { TranslatedRichText, TranslatedRichTextPatch } from './TranslatedRichText.js';
import { Version } from './Version.js';

describe('PlatformMembershipTypeConfig', () => {
    describe('getMaximumEndDate', () => {
        test('returns the configured end date for period memberships', () => {
            const endDate = Formatter.luxon().set({ year: 2026, month: 5, day: 31, hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
            const startDate = Formatter.luxon().set({ year: 2026, month: 5, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: 1,
            });
            const maximumEndDate = config.getMaximumEndDate(
                startDate,
                PlatformMembershipTypeBehaviour.Period,
            );
            const maximumEndDateBrussels = Formatter.luxon(maximumEndDate);

            expect(maximumEndDateBrussels.year).toBe(2026);
            expect(maximumEndDateBrussels.month).toBe(5);
            expect(maximumEndDateBrussels.day).toBe(31);
            expect(maximumEndDateBrussels.hour).toBe(23);
            expect(maximumEndDateBrussels.minute).toBe(59);
            expect(maximumEndDateBrussels.second).toBe(59);
        });

        test('returns the configured end date for days memberships without maximum days', () => {
            const endDate = Formatter.luxon().set({ year: 2026, month: 5, day: 31, hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
            const startDate = Formatter.luxon().set({ year: 2026, month: 5, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: null,
            });
            const maximumEndDate = config.getMaximumEndDate(startDate, PlatformMembershipTypeBehaviour.Days);
            const maximumEndDateBrussels = Formatter.luxon(maximumEndDate);

            expect(maximumEndDateBrussels.year).toBe(2026);
            expect(maximumEndDateBrussels.month).toBe(5);
            expect(maximumEndDateBrussels.day).toBe(31);
            expect(maximumEndDateBrussels.hour).toBe(23);
            expect(maximumEndDateBrussels.minute).toBe(59);
            expect(maximumEndDateBrussels.second).toBe(59);
        });

        test('calculates inclusive maximum days for days memberships', () => {
            const endDate = Formatter.luxon().set({ year: 2026, month: 5, day: 31, hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate();
            const startDate = Formatter.luxon().set({ year: 2026, month: 5, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();
            const config = PlatformMembershipTypeConfig.create({
                endDate,
                maximumDays: 2,
            });

            const maximumEndDate = config.getMaximumEndDate(startDate, PlatformMembershipTypeBehaviour.Days);
            const maximumEndDateBrussels = Formatter.luxon(maximumEndDate);

            expect(maximumEndDateBrussels.year).toBe(2026);
            expect(maximumEndDateBrussels.month).toBe(5);
            expect(maximumEndDateBrussels.day).toBe(2);
            expect(maximumEndDateBrussels.hour).toBe(23);
            expect(maximumEndDateBrussels.minute).toBe(59);
            expect(maximumEndDateBrussels.second).toBe(59);
        });
    });
});

describe('Platform tenant identity', () => {
    function roundtrip(platform: Platform, version: number = Version): Platform {
        const encoded = JSON.parse(JSON.stringify(platform.encode({ version })));
        return Platform.decode(new ObjectData(encoded, { version }));
    }

    test('the identity survives an encode and decode', () => {
        const platform = Platform.create({
            id: 'tenant-a',
            feesTenantId: 'tenant-root',
            uri: 'tenant-a',
            domain: 'a.example.com',
        });

        const decoded = roundtrip(platform);

        expect(decoded.id).toBe('tenant-a');
        expect(decoded.feesTenantId).toBe('tenant-root');
        expect(decoded.uri).toBe('tenant-a');
        expect(decoded.domain).toBe('a.example.com');
    });

    test('the parent tenant survives an encode and decode', () => {
        const platform = Platform.create({
            id: 'tenant-a',
            parentTenant: Platform.create({ id: 'tenant-root', uri: 'root' }),
        });

        const decoded = roundtrip(platform);

        expect(decoded.parentTenant?.id).toBe('tenant-root');
        expect(decoded.parentTenant?.uri).toBe('root');
    });

    test('a root tenant has no parent and charges its own fees', () => {
        const decoded = roundtrip(Platform.create({ id: '1', feesTenantId: '1' }));

        expect(decoded.parentTenant).toBeNull();
        expect(decoded.feesTenantId).toBe('1');
    });
});

describe('PlatformConfig.canInheritPlatformResponsibilityPermissions', () => {
    test('allows every email address without domains', () => {
        const config = PlatformConfig.create({});
        expect(config.canInheritPlatformResponsibilityPermissions('john@gmail.com')).toBe(true);
    });

    test('only allows exact domain matches', () => {
        const config = PlatformConfig.create({ responsibilityEmailDomains: ['KSA.be'] });
        expect(config.canInheritPlatformResponsibilityPermissions('john@ksa.be')).toBe(true);
        expect(config.canInheritPlatformResponsibilityPermissions('John@KSA.BE')).toBe(true);
        expect(config.canInheritPlatformResponsibilityPermissions('john@gent.ksa.be')).toBe(false);
        expect(config.canInheritPlatformResponsibilityPermissions('john@notksa.be')).toBe(false);
        expect(config.canInheritPlatformResponsibilityPermissions('john@ksa.be.evil.com')).toBe(false);
        expect(config.canInheritPlatformResponsibilityPermissions('john@gmail.com')).toBe(false);
        expect(config.canInheritPlatformResponsibilityPermissions('ksa.be')).toBe(false);
    });

    test('subdomains need to be added separately', () => {
        const config = PlatformConfig.create({ responsibilityEmailDomains: ['@ksa.be', 'gent.ksa.be'] });
        expect(config.canInheritPlatformResponsibilityPermissions('john@ksa.be')).toBe(true);
        expect(config.canInheritPlatformResponsibilityPermissions('john@gent.ksa.be')).toBe(true);
        expect(config.canInheritPlatformResponsibilityPermissions('john@brugge.ksa.be')).toBe(false);
    });
});

const dutch = RichText.create({ html: '<p>Hallo</p>', text: 'Hallo' });
const french = RichText.create({ html: '<p>Bonjour</p>', text: 'Bonjour' });
const english = RichText.create({ html: '<p>Hello</p>', text: 'Hello' });

/**
 * The footer texts became translatable in the current Version, bumped manually because
 * NextVersion does not support upgrade/downgrade, so Version - 1 behaves as an older client.
 */
describe('PlatformConfig footer text versioning', () => {
    const originalGetLanguage = (globalThis as any).$getLanguage;

    afterEach(() => {
        (globalThis as any).$getLanguage = originalGetLanguage;
    });

    function setLanguage(language: Language) {
        (globalThis as any).$getLanguage = () => language;
    }

    const fields = ['footerText', 'shopFooterText'] as const;

    describe.each(fields)('%s', (field) => {
        it('upgrades a RichText from an older version', () => {
            const encoded = PlatformConfig.create({}).encode({ version: Version - 1 }) as Record<string, unknown>;
            encoded[field] = dutch.encode({ version: Version - 1 });

            const decoded = new ObjectData(encoded, { version: Version - 1 }).decode(PlatformConfig);
            expect(decoded[field]).toBeInstanceOf(TranslatedRichText);
            expect(decoded[field].isDefault).toBe(true);
            expect(decoded[field].html).toBe('<p>Hallo</p>');
        });

        it('downgrades to a RichText in the request language for older clients', () => {
            const config = PlatformConfig.create({
                [field]: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
            });

            setLanguage(Language.French);
            const encoded = config.encode({ version: Version - 1 }) as Record<string, unknown>;
            const richText = new ObjectData(encoded[field], { version: Version - 1 }).decode(RichText);
            expect(richText.text).toBe('Bonjour');
        });

        it('keeps all translations when encoding and decoding the latest version', () => {
            const config = PlatformConfig.create({
                [field]: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
            });

            const decoded = new ObjectData(config.encode({ version: Version }), { version: Version }).decode(PlatformConfig);
            expect(decoded[field].get(Language.Dutch).text).toBe('Hallo');
            expect(decoded[field].get(Language.French).text).toBe('Bonjour');
        });

        it('upgrades a RichText patch from an older client', () => {
            const encoded = PlatformConfig.patch({}).encode({ version: Version - 1 }) as Record<string, unknown>;
            encoded[field] = dutch.encode({ version: Version - 1 });

            const decoded = new ObjectData(encoded, { version: Version - 1 }).decode(PlatformConfig.patchType());
            const patched = PlatformConfig.create({}).patch(decoded);
            expect(patched[field]).toBeInstanceOf(TranslatedRichText);
            expect(patched[field].html).toBe('<p>Hallo</p>');
        });

        it('only changes the Dutch text for a patch from an older client', () => {
            const config = PlatformConfig.create({
                [field]: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
            });

            const encoded = PlatformConfig.patch({}).encode({ version: Version - 1 }) as Record<string, unknown>;
            encoded[field] = english.encode({ version: Version - 1 });

            const decoded = new ObjectData(encoded, { version: Version - 1 }).decode(PlatformConfig.patchType());
            const patched = config.patch(decoded);
            expect(patched[field].get(Language.Dutch).text).toBe('Hello');
            expect(patched[field].get(Language.French).text).toBe('Bonjour');
        });

        it('encodes and decodes a language patch', () => {
            const config = PlatformConfig.create({
                [field]: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
            });
            const patch = PlatformConfig.patch({
                [field]: new TranslatedRichTextPatch({ [Language.English]: english, [Language.French]: null }),
            });

            const decoded = new ObjectData(patch.encode({ version: Version }), { version: Version }).decode(PlatformConfig.patchType());
            expect(decoded[field]).toBeInstanceOf(TranslatedRichTextPatch);

            const patched = config.patch(decoded);
            expect(patched[field].languages.sort()).toEqual([Language.Dutch, Language.English].sort());
        });

        it('downgrades a language patch to a RichText for older clients', () => {
            const patch = PlatformConfig.patch({
                [field]: new TranslatedRichTextPatch({ [Language.Dutch]: dutch }),
            });

            const encoded = patch.encode({ version: Version - 1 }) as Record<string, unknown>;
            expect(new ObjectData(encoded[field], { version: Version - 1 }).decode(RichText).text).toBe('Hallo');
        });
    });
});
