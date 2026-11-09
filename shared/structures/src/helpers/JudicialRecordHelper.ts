import { Formatter } from '@stamhoofd/utility';
import type { Organization } from '../Organization.js';
import type { Platform } from '../Platform.js';

/**
 * `getStatus` only ever answers `NotRequired` or `Required` today, because the outcome of a delivered
 * extract is not stored yet. The two delivered outcomes live here rather than in an enum of their own
 * so that a member has one judicial record status, not two that have to be combined at every call site.
 */
export enum JudicialRecordStatus {
    /** The member doesn't have to have a judicial record extract checked. */
    NotRequired = 'NotRequired',

    /** The member has to have a judicial record extract checked. */
    Required = 'Required',

    /** An extract was delivered and a reviewer has to look at it. */
    UnderReview = 'UnderReview',

    /** An extract was delivered and every automatic check passed, so nobody has to open it. */
    Ok = 'Ok',
}

/**
 * A status with the reason behind it, so a member view can explain why an extract is (not) required.
 */
export interface JudicialRecordStatusWithReason {
    status: JudicialRecordStatus;

    /** Human readable reason, mentioning a date when that makes it clearer. */
    description: string;
}

/**
 * One of a member's responsibilities, reduced to what decides whether a judicial record extract is required.
 */
export interface JudicialRecordResponsibility {
    startDate: Date;
    endDate: Date | null;

    /** `judicialRecordMinimumAge` of the responsibility this record points to, null when it never asks for an extract. */
    minimumAge: number | null;
}

export class JudicialRecordHelper {
    /**
     * Whether any responsibility asks for a judicial record extract.
     *
     * Without a single one the status is `NotRequired` for every member, so a column or filter built on it is noise.
     * Organizations can define their own responsibilities next to the platform ones, so both are checked.
     */
    static asksForExtract({ platform, organization }: { platform: Platform; organization?: Organization | null }): boolean {
        return [
            ...platform.config.responsibilities,
            ...(organization?.privateMeta?.responsibilities ?? []),
        ].some(responsibility => responsibility.judicialRecordMinimumAge !== null);
    }

    static getStatusName(status: JudicialRecordStatus): string {
        switch (status) {
            case JudicialRecordStatus.Required:
                return $t(`Vereist`);
            case JudicialRecordStatus.NotRequired:
                return $t(`Niet vereist`);
            case JudicialRecordStatus.UnderReview:
                return $t(`Wordt beoordeeld`);
            case JudicialRecordStatus.Ok:
                return $t(`OK`);
        }
    }

    /**
     * The date from which a member is at least `minimumAge` years old. Null when their birth day is unknown.
     */
    static getMinimumAgeDate(birthDay: Date | null, minimumAge: number): Date | null {
        if (birthDay === null) {
            return null;
        }

        return Formatter.luxon(birthDay).startOf('day').plus({ years: minimumAge }).toJSDate();
    }

    /** Whether the member holds this responsibility on `atDate`. */
    static holdsResponsibility(responsibility: JudicialRecordResponsibility, atDate: Date): boolean {
        return responsibility.startDate <= atDate && (responsibility.endDate === null || responsibility.endDate > atDate);
    }

    /**
     * Whether this single responsibility requires the member to have an extract checked on `atDate`.
     */
    static requiresExtract({ responsibility, birthDay, atDate = new Date() }: {
        responsibility: JudicialRecordResponsibility;
        birthDay: Date | null;
        atDate?: Date;
    }): boolean {
        if (responsibility.minimumAge === null) {
            return false;
        }

        if (!this.holdsResponsibility(responsibility, atDate)) {
            return false;
        }

        // Members without a birth day are treated as adults, the same way MemberDetails.defaultAge does.
        const minimumAgeDate = this.getMinimumAgeDate(birthDay, responsibility.minimumAge);
        return minimumAgeDate === null || minimumAgeDate <= atDate;
    }

    /**
     * The judicial record status of the member on `atDate`, with the reason behind it.
     */
    static getStatus({ firstName, birthDay, responsibilities, atDate = new Date() }: {
        /** Used in the description, so it talks about the member by name. */
        firstName: string;
        birthDay: Date | null;
        responsibilities: JudicialRecordResponsibility[];
        atDate?: Date;
    }): JudicialRecordStatusWithReason {
        const status = responsibilities.some(responsibility => this.requiresExtract({ responsibility, birthDay, atDate }))
            ? JudicialRecordStatus.Required
            : JudicialRecordStatus.NotRequired;

        /** The earliest date an extract is required from, over the responsibilities the member holds on `atDate`. */
        let requiredFrom: Date | null = null;

        /** The minimum age that decides `requiredFrom`, null when the start of the responsibility decides it. */
        let requiredFromAge: number | null = null;

        for (const responsibility of responsibilities) {
            if (responsibility.minimumAge === null || !this.holdsResponsibility(responsibility, atDate)) {
                continue;
            }

            const minimumAgeDate = this.getMinimumAgeDate(birthDay, responsibility.minimumAge);
            const reachesAgeLater = minimumAgeDate !== null && minimumAgeDate > responsibility.startDate;
            const date = reachesAgeLater ? minimumAgeDate : responsibility.startDate;

            if (requiredFrom === null || date < requiredFrom) {
                requiredFrom = date;
                requiredFromAge = reachesAgeLater ? responsibility.minimumAge : null;
            }
        }

        if (requiredFrom === null) {
            if (!responsibilities.some(responsibility => this.holdsResponsibility(responsibility, atDate))) {
                return {
                    status,
                    description: $t(`{name} heeft geen functies.`, { name: firstName }),
                };
            }

            return {
                status,
                description: $t(`Geen enkele functie van {name} vraagt een uittreksel uit het strafregister.`, { name: firstName }),
            };
        }

        const date = Formatter.date(requiredFrom, true);

        if (requiredFromAge !== null) {
            const ordinal = Formatter.ordinalNumber(requiredFromAge);

            return {
                status,
                description: status === JudicialRecordStatus.Required
                    ? $t(`Sinds {date}, de {ordinal} verjaardag van {name}.`, { date, ordinal, name: firstName })
                    : $t(`Vanaf {date}, de {ordinal} verjaardag van {name}.`, { date, ordinal, name: firstName }),
            };
        }

        return {
            status,
            description: status === JudicialRecordStatus.Required
                ? $t(`Sinds {date}, de startdatum van de functie.`, { date })
                : $t(`Vanaf {date}, de startdatum van de functie.`, { date }),
        };
    }
}
