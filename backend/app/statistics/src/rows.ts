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
    cycle: number;
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
 * Only the postal code and city of the address survive: the report maps units by postal code and
 * lists them by city. An organization is a legal entity rather than a natural person.
 */
export function flattenOrganization(organization: OrganizationSource): StatisticsRow {
    return {
        id: organization.id,
        name: organization.name,
        uri: organization.uri,
        postalCode: emptyToNull(organization.address.postalCode),
        city: emptyToNull(organization.address.city),
        periodId: organization.periodId,
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
        cycle: group.cycle,
        status: group.status,
        deletedAt: group.deletedAt,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
    };
}

/**
 * The date of birth and the postal code are carried over because the report needs them: it charts
 * members by age, which is only exact with the date behind it, and maps them by postal code. The
 * rest of the address and everything that names or reaches the member stays behind.
 *
 * The birth date is written as the calendar date the application means, not as an instant. A member
 * born on 17 May is held as midnight in Europe/Brussels, which a process running in UTC would write
 * to a date column as 16 May — a day early for every member.
 */
export function flattenMember(member: MemberSource): StatisticsRow {
    return {
        id: member.id,
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

export function flattenResponsibilityRecord(record: ResponsibilityRecordSource): StatisticsRow {
    return {
        id: record.id,
        memberId: record.memberId,
        groupId: record.groupId,
        organizationId: record.organizationId,
        responsibilityId: record.responsibilityId,
        startDate: record.startDate,
        endDate: record.endDate,
    };
}

export function flattenNamedConfig(config: NamedConfigSource): StatisticsRow {
    return { id: config.id, name: config.name };
}

export function flattenDefaultAgeGroup(group: { id: string; name: string; minAge: number | null; maxAge: number | null }): StatisticsRow {
    return { id: group.id, name: group.name, minAge: group.minAge, maxAge: group.maxAge };
}

function emptyToNull(value: string): string | null {
    return value.length === 0 ? null : value;
}
