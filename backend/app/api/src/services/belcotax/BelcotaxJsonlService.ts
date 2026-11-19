import { countDays } from '@stamhoofd/models/helpers/countDays.js';
import type { CountryCode } from '@stamhoofd/types/Country';
import { Country } from '@stamhoofd/types/Country';
import { DataValidator, Formatter } from '@stamhoofd/utility';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import deleteFicheSchema from './schemas/2026/delete-fiche.json' with { type: 'json' };
import fiche86Schema from './schemas/2026/fiche-86.json' with { type: 'json' };
import contactSchema from './schemas/2026/resource-contact.json' with { type: 'json' };
import organisationSchema from './schemas/2026/resource-organisation.json' with { type: 'json' };
import personSchema from './schemas/2026/resource-person.json' with { type: 'json' };

type AddressLike = {
    street?: string | null;
    number?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
};

type PersonContext = {
    firstName?: string | null;
    lastName?: string | null;
    nationalRegisterNumber?: string | null;
    birthDay?: Date | null;
    address?: AddressLike | null;
};

/**
 * The part of the handlebars context of a fiscal document (DocumentRenderService.buildDocumentContext) that Belcotax needs.
 */
export type FiscalDocumentContext = {
    debtor?: PersonContext | null;
    member?: PersonContext | null;
    registration?: {
        startDate?: Date | null;
        endDate?: Date | null;
        /** With 4 decimal places, like every price in Stamhoofd (1 euro = 10000) */
        price?: number | null;
        days?: number | null;
    } | null;
    certification?: {
        type?: string | null;
        name?: string | null;
        companyNumber?: string | null;
        address?: AddressLike | null;
    } | null;
};

/**
 * The entity that organises the childcare (zone `d`) and submits the fiches.
 * For fiche 281.86 Belcotax only accepts an organiser with an existing company number (KBO) and an address.
 */
export type BelcotaxOrganiser = {
    id: string;
    name: string;
    companyNumber: string | null;
    address: AddressLike | null;
};

export type BelcotaxContact = {
    name: string;
    phone: string | null;
    email: string;
};

export type BelcotaxExportInput = {
    year: number;
    templateId: string;
    organiser: BelcotaxOrganiser;
    contact: BelcotaxContact;
    documents: { id: string; context: FiscalDocumentContext }[];
    deletedDocumentIds: string[];
};

/**
 * A document that cannot be sent; documentId is null when the whole export is blocked (organiser, contact or certification).
 */
export type BelcotaxIssue = {
    documentId: string | null;
    message: string;
    /**
     * The data passed our own checks but not the schema of FOD, so the mapping is wrong and not the organization.
     */
    isMappingError?: boolean;
};

export type BelcotaxExport = {
    jsonl: string;
    includedDocumentIds: string[];
    issues: BelcotaxIssue[];
};

type JsonLine = Record<string, unknown>;

/**
 * Prefix of every key we generate, said to be good practice to avoid other software (or manual uploaded documents) to use the same keys.
 */
const KEY_PREFIX = 'STA';

/**
 * Schema version of fiche 281.86 per income year; FOD bumps it when the zones change.
 * Keep FiscalDocumentYearHelper.isJsonlExportSupported in step, so the dashboard only offers the years we can build.
 */
const FICHE_86_VERSIONS: Record<number, string> = {
    2026: '2',
};

/**
 * Belcotax expects NIS country codes. Source: socialsecurity.be, LOIC glossary annex 5 "Lijst met landcodes" (version 2026/2).
 */
const NIS_COUNTRY_CODES: Record<CountryCode, string> = {
    [Country.Belgium]: '150',
    [Country.Netherlands]: '129',
    [Country.Luxembourg]: '113',
    [Country.France]: '111',
    [Country.Germany]: '103',
    [Country.Sweden]: '126',
    [Country.UnitedKingdom]: '112',
    [Country.Switzerland]: '127',
    [Country.Afghanistan]: '251',
    [Country.CzechRepublic]: '140',
    [Country.UnitedStates]: '402',
    [Country.Austria]: '105',
    [Country.Portugal]: '123',
};

const CERTIFICATION_TYPES: Record<string, string> = {
    exception: '0',
    'kind-en-gezin': '1',
    authorities: '2',
    foreign: '3',
    schools: '4',
};

let validators: {
    fiche86: ValidateFunction;
    person: ValidateFunction;
    organisation: ValidateFunction;
    contact: ValidateFunction;
    deleteFiche: ValidateFunction;
} | null = null;

function getValidators() {
    if (validators) {
        return validators;
    }
    // The schemas use FOD specific keywords (mask, unit, zoneType) and meta schemas that are not published.
    // multipleOf 0.01 fails on binary floats (33.33 / 0.01 = 3332.9999...), while the JSON text "33.33" is exact.
    const ajv = new Ajv2020({
        strict: false,
        validateFormats: false,
        allErrors: true,
        multipleOfPrecision: 9,
    });
    const compile = (schema: Record<string, unknown>) => {
        const withoutMetaSchema = { ...schema };
        delete withoutMetaSchema['$schema'];
        return ajv.compile(withoutMetaSchema);
    };
    validators = {
        fiche86: compile(fiche86Schema),
        person: compile(personSchema),
        organisation: compile(organisationSchema),
        contact: compile(contactSchema),
        deleteFiche: compile(deleteFicheSchema),
    };
    return validators;
}

function clean(value: string | null | undefined, maxLength = 100): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.substring(0, maxLength);
}

function digits(value: string | null | undefined): string {
    return (value ?? '').replace(/\D+/g, '');
}

/**
 * Converts a Stamhoofd price (4 decimal places) to euros with at most two decimals.
 */
function euros(price: number): number {
    return Math.round(price / 100) / 100;
}

export class BelcotaxJsonlService {
    static isSupportedYear(year: number): boolean {
        return FICHE_86_VERSIONS[year] !== undefined;
    }

    /**
     * The key of the fiche of a document, e.g. STA-2026-<documentId>. Its debtor and child get the same key with -b and -c.
     */
    static ficheKey(year: number, documentId: string) {
        return `${KEY_PREFIX}-${year}-${documentId}`;
    }

    static build(input: BelcotaxExportInput): BelcotaxExport {
        const version = FICHE_86_VERSIONS[input.year];
        if (version === undefined) {
            throw new Error(`Belcotax export is not supported for income year ${input.year}`);
        }
        const v = getValidators();
        const issues: BelcotaxIssue[] = [];

        const organiser = this.buildOrganiser(input.organiser);
        const contact = this.buildContact(input.templateId, input.contact);
        const shared: JsonLine[] = [];

        const organiserIssues = this.checkOrganiser(input.organiser);
        for (const message of organiserIssues) {
            issues.push({ documentId: null, message });
        }
        if (organiserIssues.length === 0 && !this.isValid(v.organisation, organiser.line)) {
            issues.push({
                documentId: null,
                message: $t('De gegevens van de organisator zijn onvolledig of ongeldig.'),
                isMappingError: true,
            });
        }
        // The schema only requires the e-mail address, a contact without a name is of no use to the FOD
        if (!clean(input.contact.name) || !this.isValid(v.contact, contact)) {
            issues.push({
                documentId: null,
                message: $t(
                    'De contactpersoon voor Belcotax is onvolledig of ongeldig (naam en e-mailadres zijn verplicht).',
                ),
            });
        }
        shared.push(contact, organiser.line);

        const certifiers = new Map<string, JsonLine>();
        const fiches: JsonLine[] = [];
        const includedDocumentIds: string[] = [];

        for (const document of input.documents) {
            const documentIssues: string[] = [];
            const key = this.ficheKey(input.year, document.id);
            const context = document.context;

            const debtor = this.buildPerson(`${key}-b`, context.debtor);
            const child = this.buildPerson(`${key}-c`, context.member, true);
            const period = this.buildPeriod(context, documentIssues);
            documentIssues.push(...this.checkPersons(context, debtor.flags, child.flags));

            const certification = this.buildCertification(
                input.templateId,
                context,
                documentIssues,
            );

            const fiche: JsonLine = {
                $s: `urn:f:d:${input.year}:86:${version}:nl`,
                k: key,
                d: organiser.key,
                b: debtor.key,
                childRef: child.key,
                c: contact['k'],
                '4101': period ? [period] : [],
                ...(certification.code ? { 2031: certification.code } : {}),
                ...(certification.line ? { certRef: certification.line['k'] } : {}),
            };

            const linesToValidate: [ValidateFunction, JsonLine][] = [
                [v.fiche86, fiche],
                [v.person, debtor.line],
                [v.person, child.line],
            ];
            if (certification.line) {
                linesToValidate.push([v.organisation, certification.line]);
            }
            if (documentIssues.length > 0) {
                for (const message of documentIssues) {
                    issues.push({ documentId: document.id, message });
                }
                continue;
            }

            if (linesToValidate.some(([validate, line]) => !this.isValid(validate, line))) {
                issues.push({
                    documentId: document.id,
                    message: $t('Dit attest voldoet niet aan het formaat van Belcotax.'),
                    isMappingError: true,
                });
                continue;
            }

            if (certification.line) {
                certifiers.set(certification.line['k'] as string, certification.line);
            }
            fiches.push(debtor.line, child.line, fiche);
            includedDocumentIds.push(document.id);
        }

        // We verified on the FOD pre-production environment (2026-11-18): a delete line for a key Belcotax does not
        // know is accepted, so a deletion can be sent without knowing whether the fiche was ever uploaded.
        const deletions: JsonLine[] = input.deletedDocumentIds.map((id) => ({
            $s: 'urn:f:x:1',
            k: this.ficheKey(input.year, id),
        }));
        for (const line of deletions) {
            if (!this.isValid(v.deleteFiche, line)) {
                throw new Error('Invalid Belcotax delete line');
            }
        }

        const lines = [...shared, ...certifiers.values(), ...fiches, ...deletions];
        return {
            jsonl: lines.map((line) => JSON.stringify(line)).join('\n') + '\n',
            includedDocumentIds,
            issues,
        };
    }

    private static isValid(validate: ValidateFunction, line: JsonLine): boolean {
        return validate(line) === true;
    }

    private static buildAddress(address: AddressLike | null | undefined): JsonLine | undefined {
        if (!address) {
            return undefined;
        }
        const country =
            address.country && Object.hasOwn(NIS_COUNTRY_CODES, address.country)
                ? NIS_COUNTRY_CODES[address.country as CountryCode]
                : undefined;
        if (!country) {
            return undefined;
        }
        const result: JsonLine = { l: country };
        const fields: [string, string | undefined][] = [
            ['s', clean(address.street)],
            ['n', clean(address.number, 20)],
            ['p', clean(address.postalCode, 50)],
            ['c', clean(address.city)],
        ];
        for (const [field, value] of fields) {
            if (value) {
                result[field] = value;
            }
        }
        return result;
    }

    private static isCompleteAddress(address: JsonLine | undefined): boolean {
        return !!address && !!address['s'] && !!address['p'] && !!address['c'];
    }

    private static buildOrganiser(organiser: BelcotaxOrganiser) {
        const key = `${KEY_PREFIX}-org-${organiser.id}`;
        const line: JsonLine = {
            $s: 'urn:r:d:o:1:nl',
            k: key,
            n: { nl: clean(organiser.name, 255) },
        };
        const companyNumber = this.normalizeCompanyNumber(organiser.companyNumber);
        if (companyNumber) {
            line['i'] = { cbein: companyNumber };
        }
        const address = this.buildAddress(organiser.address);
        if (address) {
            line['a'] = address;
        }
        return { key, line };
    }

    private static checkOrganiser(organiser: BelcotaxOrganiser): string[] {
        const issues: string[] = [];
        if (!clean(organiser.name)) {
            issues.push($t('De naam van de organisator ontbreekt.'));
        }
        // Belcotax also rejects an organiser that is identified by a refertenummer or by its name and address only
        if (!digits(organiser.companyNumber)) {
            issues.push(
                $t(
                    'De organisator heeft geen ondernemingsnummer. Belcotax aanvaardt fiscale attesten enkel van een organisator met een ondernemingsnummer.',
                ),
            );
        } else if (!this.normalizeCompanyNumber(organiser.companyNumber)) {
            issues.push($t('Het ondernemingsnummer van de organisator is ongeldig.'));
        }
        if (!this.isCompleteAddress(this.buildAddress(organiser.address))) {
            issues.push($t('Het adres van de organisator is onvolledig.'));
        }
        return issues;
    }

    private static normalizeCompanyNumber(companyNumber: string | null): string | null {
        let value = digits(companyNumber);
        if (value.length === 9) {
            value = '0' + value;
        }
        return /^[019]\d{9}$/.test(value) ? value : null;
    }

    private static buildContact(templateId: string, contact: BelcotaxContact): JsonLine {
        const [firstName, ...lastNames] = contact.name.trim().split(/\s+/);
        const line: JsonLine = {
            $s: 'urn:r:d:c:1:nl',
            k: `${KEY_PREFIX}-contact-${templateId}`,
            e: contact.email.trim(),
            l: 'nl',
        };
        if (clean(firstName, 50)) {
            line['fn'] = [clean(firstName, 50)];
        }
        if (clean(lastNames.join(' '), 50)) {
            line['ln'] = [clean(lastNames.join(' '), 50)];
        }
        const phone = contact.phone ? parsePhoneNumberFromString(contact.phone, 'BE') : undefined;
        if (phone?.isValid()) {
            const isBelgianMobile =
                phone.countryCallingCode === '32' && phone.nationalNumber.startsWith('4');
            line['p'] =
                isBelgianMobile || phone.countryCallingCode !== '32'
                    ? { m: phone.number }
                    : { l: phone.number };
        }
        return line;
    }

    private static buildPerson(
        key: string,
        person: PersonContext | null | undefined,
        includeBirthDay = false,
    ) {
        const line: JsonLine = { $s: 'urn:r:d:p:1:nl', k: key };
        const flags = {
            hasNationalRegisterNumber: false,
            hasName: false,
            hasAddress: false,
            hasBirthDay: false,
        };
        const nationalRegisterNumber = digits(person?.nationalRegisterNumber);
        // The same rule as everywhere else in Stamhoofd: Belcotax refuses the whole file for one wrong number
        if (DataValidator.verifyBelgianNationalNumber(nationalRegisterNumber)) {
            line['i'] = { ssin: nationalRegisterNumber };
            flags.hasNationalRegisterNumber = true;
        }
        const firstName = clean(person?.firstName, 50);
        const lastName = clean(person?.lastName, 50);
        if (firstName) {
            line['fn'] = [firstName];
        }
        if (lastName) {
            line['ln'] = [lastName];
        }
        flags.hasName = !!firstName && !!lastName;
        if (includeBirthDay && person?.birthDay) {
            line['bd'] = Formatter.dateIso(person.birthDay);
            flags.hasBirthDay = true;
        }
        const address = this.buildAddress(person?.address);
        if (address) {
            line['a'] = address;
        }
        flags.hasAddress = this.isCompleteAddress(address);
        return { key, line, flags };
    }

    private static checkPersons(
        context: FiscalDocumentContext,
        debtor: { hasNationalRegisterNumber: boolean; hasName: boolean; hasAddress: boolean },
        child: {
            hasNationalRegisterNumber: boolean;
            hasName: boolean;
            hasAddress: boolean;
            hasBirthDay: boolean;
        },
    ): string[] {
        const issues: string[] = [];
        if (!debtor.hasNationalRegisterNumber && !(debtor.hasName && debtor.hasAddress)) {
            issues.push(
                $t(
                    'Van de schuldenaar ontbreekt het rijksregisternummer of de naam en het volledige adres.',
                ),
            );
        }
        if (
            !child.hasNationalRegisterNumber &&
            !(child.hasName && child.hasAddress && child.hasBirthDay)
        ) {
            issues.push(
                $t(
                    'Van het kind ontbreekt het rijksregisternummer of de naam, geboortedatum en het volledige adres.',
                ),
            );
        }
        if (digits(context.debtor?.nationalRegisterNumber) && !debtor.hasNationalRegisterNumber) {
            issues.push($t('Het rijksregisternummer van de schuldenaar is ongeldig.'));
        }
        if (digits(context.member?.nationalRegisterNumber) && !child.hasNationalRegisterNumber) {
            issues.push($t('Het rijksregisternummer van het kind is ongeldig.'));
        }
        const debtorNumber = digits(context.debtor?.nationalRegisterNumber);
        if (
            debtor.hasNationalRegisterNumber &&
            debtorNumber === digits(context.member?.nationalRegisterNumber)
        ) {
            issues.push($t('De schuldenaar en het kind hebben hetzelfde rijksregisternummer.'));
        }
        return issues;
    }

    private static buildPeriod(context: FiscalDocumentContext, issues: string[]): JsonLine | null {
        const registration = context.registration;
        const startDate = registration?.startDate;
        const endDate = registration?.endDate;
        if (!startDate || !endDate) {
            issues.push($t('De begin- of einddatum van de opvang ontbreekt.'));
            return null;
        }
        if (startDate.getTime() > endDate.getTime()) {
            issues.push($t('De einddatum van de opvang ligt voor de begindatum.'));
            return null;
        }
        const maximumDays = countDays(startDate, endDate);
        const days = registration.days ?? maximumDays;
        if (!Number.isInteger(days) || days < 1 || days > maximumDays) {
            issues.push(
                $t(
                    'Het aantal opvangdagen moet tussen 1 en het aantal dagen van de periode liggen.',
                ),
            );
            return null;
        }
        const price = registration.price ?? 0;
        if (price <= 0) {
            issues.push($t('Het betaalde bedrag ontbreekt.'));
            return null;
        }
        // The daily rate (2111) is optional and rounded on its own, so days x rate would not add up to the total
        return {
            2055: Formatter.dateIso(startDate),
            2056: Formatter.dateIso(endDate),
            2110: days,
            2060: euros(price),
        };
    }

    private static buildCertification(
        templateId: string,
        context: FiscalDocumentContext,
        issues: string[],
    ) {
        const certification = context.certification;
        const code = certification?.type ? CERTIFICATION_TYPES[certification.type] : undefined;
        if (code === undefined) {
            issues.push($t('Het vergunningstype van de opvang ontbreekt.'));
            return { code: undefined, line: null };
        }
        if (code === '0') {
            return { code, line: null };
        }
        const name = clean(certification?.name, 255);
        if (!name) {
            issues.push($t('De naam van de certificeringsautoriteit ontbreekt.'));
            return { code, line: null };
        }
        const line: JsonLine = {
            $s: 'urn:r:d:o:1:nl',
            k: `${KEY_PREFIX}-cert-${templateId}`,
            n: { nl: name },
        };
        const companyNumber = this.normalizeCompanyNumber(certification?.companyNumber ?? null);
        if (companyNumber) {
            line['i'] = { cbein: companyNumber };
        }
        const address = this.buildAddress(certification?.address);
        if (address) {
            line['a'] = address;
        }
        return { code, line };
    }
}
