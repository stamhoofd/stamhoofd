import { Formatter } from '@stamhoofd/utility';

/**
 * Turns source records into the rows of the statistics database.
 *
 * Every function here is pure and drops most of the personal data on the way: a member arrives with a
 * full `MemberDetails` and leaves as a date of birth, a gender and a postal code. Nothing in this
 * file may start returning a name, an email address or a phone number — the statistics database has
 * no columns for them, and the schema test would fail if it did.
 *
 * The inputs are described structurally rather than as model classes, so the models satisfy them
 * without this package depending on how they are loaded.
 */

export type StatisticsRow = Record<string, string | number | boolean | Date | null>;

/**
 * The language translated names are resolved in. The statistics database holds one name per group,
 * and the sync has no request to take a language from, so it picks the platform's own rather than
 * whatever language happens to be set on the process.
 */
export const statisticsLanguage = 'nl';

export type RegistrationPeriodSource = {
    id: string;
    startDate: Date;
    endDate: Date;
    locked: boolean;
    organizationId: string | null;
    previousPeriodId: string | null;
    nextPeriodId: string | null;
    customName: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type OrganizationSource = {
    id: string;
    name: string;
    uri: string;
    address: { postalCode: string; city: string };
    periodId: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type GroupSource = {
    id: string;
    type: string;
    settings: { name: { get: (language: string) => string } };
    organizationId: string;
    periodId: string | null;
    defaultAgeGroupId: string | null;
    status: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export type MemberSource = {
    id: string;
    details: { birthDay: Date | null; gender: string; address: { postalCode: string } | null };
    organizationId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastRegisteredAt: Date | null;
};

export type RegistrationSource = {
    id: string;
    organizationId: string;
    memberId: string;
    groupId: string;
    periodId: string | null;
    registeredAt: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    trialUntil: Date | null;
    deactivatedAt: Date | null;
    waitingList: boolean;
    cycle: number;
    createdAt: Date;
    updatedAt: Date;
};

export type MembershipSource = {
    id: string;
    memberId: string;
    membershipTypeId: string;
    organizationId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    expireDate: Date | null;
    trialUntil: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export type ResponsibilityRecordSource = {
    id: string;
    memberId: string;
    groupId: string | null;
    organizationId: string | null;
    responsibilityId: string;
    startDate: Date;
    endDate: Date | null;
};

export type NamedConfigSource = { id: string; name: string };

export type PlatformSource = { id: string; config: { name: string }; membershipOrganizationId: string | null };

/**
 * The label the reports show for a period, mirroring `RegistrationPeriodBase.nameShort`: the custom
 * name when there is one, otherwise the years it spans.
 *
 * Reimplemented here rather than read off the model because the model's getter runs `$t`, which needs
 * a request to take a language from and throws in the sync. The years are resolved in the application
 * timezone, so a period starting at midnight in Brussels does not fall back into the previous year.
 */
export function periodName(period: { customName: string | null; startDate: Date; endDate: Date }): string {
    const customName = period.customName?.trim();
    if (customName) {
        return customName;
    }

    const startYear = Formatter.year(period.startDate);
    const endYear = Formatter.year(period.endDate);
    return startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`;
}

export function flattenRegistrationPeriod(period: RegistrationPeriodSource): StatisticsRow {
    return {
        id: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        locked: period.locked,
        organizationId: period.organizationId,
        previousPeriodId: period.previousPeriodId,
        nextPeriodId: period.nextPeriodId,
        customName: period.customName,
        name: periodName(period),
        createdAt: period.createdAt,
        updatedAt: period.updatedAt,
    };
}

/**
 * One row per unit per period: the unit as it was that year. A unit that is renamed or moves keeps
 * the name and the place it was counted under in the years already settled.
 *
 * `periodId` is the year this row describes, not the period the unit is in now — the latter lives on
 * the source record and is what the netwerk links are recorded against.
 *
 * Only the postal code and city of the address survive: the report maps units by postal code and
 * lists them by city. An organization is a legal entity rather than a natural person.
 */
export function flattenOrganization(organization: OrganizationSource, periodId: string): StatisticsRow {
    return {
        id: organization.id,
        periodId,
        name: organization.name,
        uri: organization.uri,
        postalCode: emptyToNull(organization.address.postalCode),
        city: emptyToNull(organization.address.city),
        active: organization.active,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
    };
}

export function flattenGroup(group: GroupSource): StatisticsRow {
    return {
        id: group.id,
        type: group.type,
        name: group.settings.name.get(statisticsLanguage),
        organizationId: group.organizationId,
        periodId: group.periodId,
        defaultAgeGroupId: group.defaultAgeGroupId,
        status: group.status,
        deletedAt: group.deletedAt,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
    };
}

/**
 * One row per member per period: what was true of this member in that year. The source holds only
 * what is true of them now, so every open period gets the current details and a frozen one keeps the
 * row it was counted with.
 *
 * The date of birth and the postal code are carried over because the report needs them: it charts
 * members by age, which is only exact with the date behind it, and maps them by postal code. The
 * rest of the address and everything that names or reaches the member stays behind.
 *
 * The birth date is written as the calendar date the application means, not as an instant. A member
 * born on 17 May is held as midnight in Europe/Brussels, which a process running in UTC would write
 * to a date column as 16 May — a day early for every member.
 */
export function flattenMember(member: MemberSource, periodId: string): StatisticsRow {
    return {
        id: member.id,
        periodId,
        birthDate: member.details.birthDay ? Formatter.dateIso(member.details.birthDay) : null,
        gender: member.details.gender,
        postalCode: member.details.address ? emptyToNull(member.details.address.postalCode) : null,
        organizationId: member.organizationId,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        lastRegisteredAt: member.lastRegisteredAt,
    };
}

export function flattenRegistration(registration: RegistrationSource): StatisticsRow {
    return {
        id: registration.id,
        organizationId: registration.organizationId,
        memberId: registration.memberId,
        groupId: registration.groupId,
        periodId: registration.periodId,
        registeredAt: registration.registeredAt,
        startDate: registration.startDate,
        endDate: registration.endDate,
        trialUntil: registration.trialUntil,
        deactivatedAt: registration.deactivatedAt,
        waitingList: registration.waitingList,
        cycle: registration.cycle,
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt,
    };
}

export function flattenMembership(membership: MembershipSource): StatisticsRow {
    return {
        id: membership.id,
        memberId: membership.memberId,
        membershipTypeId: membership.membershipTypeId,
        organizationId: membership.organizationId,
        periodId: membership.periodId,
        startDate: membership.startDate,
        endDate: membership.endDate,
        expireDate: membership.expireDate,
        trialUntil: membership.trialUntil,
        deletedAt: membership.deletedAt,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
    };
}

/**
 * One row per period the record runs through: it carries a date range rather than a year, and a
 * functie held for three years was held in each of them.
 */
export function flattenResponsibilityRecord(record: ResponsibilityRecordSource, periodId: string): StatisticsRow {
    return {
        id: record.id,
        periodId,
        memberId: record.memberId,
        groupId: record.groupId,
        organizationId: record.organizationId,
        responsibilityId: record.responsibilityId,
        startDate: record.startDate,
        endDate: record.endDate,
    };
}

/**
 * The platform configuration holds one name per tak, netwerk, lidgeldtype and functie: the one it
 * carries today. Written per period, so renaming one changes what the years still open are reported
 * under and leaves the settled ones saying what they said.
 */
export function flattenNamedConfig(config: NamedConfigSource, periodId: string): StatisticsRow {
    return { id: config.id, periodId, name: config.name };
}

/**
 * The platform itself, which the reports need for one thing: which organization it runs on its own.
 * That is the koepel rather than one of its local groups, and the jeugdbewegingen report delivers it
 * as the bovenlokale ondersteuningsstructuur.
 *
 * Not written per period, so the name here is the one the platform carries today. Nothing is reported
 * per year out of it -- the name a sheet prints is the organization's own, per period.
 */
export function flattenPlatform(platform: PlatformSource): StatisticsRow {
    return { id: platform.id, name: platform.config.name, membershipOrganizationId: platform.membershipOrganizationId };
}

export function flattenDefaultAgeGroup(group: { id: string; name: string; minAge: number | null; maxAge: number | null }, periodId: string): StatisticsRow {
    return { id: group.id, periodId, name: group.name, minAge: group.minAge, maxAge: group.maxAge };
}

function emptyToNull(value: string): string | null {
    return value.length === 0 ? null : value;
}
