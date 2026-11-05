import { Formatter } from '@stamhoofd/utility';

export enum JudicialRecordStatus {
    /** The member doesn't have to have a judicial record extract checked. */
    NotRequired = 'NotRequired',

    /** The member has to have a judicial record extract checked. */
    Required = 'Required',
}

/**
 * A status with the reason behind it, so a member view can explain why an extract is (not) required.
 */
export interface JudicialRecordRequirement {
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
    static getStatusName(status: JudicialRecordStatus): string {
        switch (status) {
            case JudicialRecordStatus.Required:
                return $t(`Vereist`);
            case JudicialRecordStatus.NotRequired:
                return $t(`Niet vereist`);
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
     * Whether this single responsibility requires the member to have an extract checked on `atDate`. The status of a
     * member is `Required` as soon as one of their responsibilities does.
     *
     * THE RULE LIVES HERE. `judicialRecordStatusExpression()` in the API
     * (`backend/app/api/src/helpers/judicialRecordStatus.ts`) is the SQL mirror of these three conditions, so the
     * member list filters and sorts on exactly what this says. Change one and you have to change the other;
     * `backend/app/api/tests/filters/judicial-record.test.ts` runs both over the same members and fails when they
     * disagree.
     */
    static requiresExtract({ responsibility, birthDay, atDate = new Date() }: {
        responsibility: JudicialRecordResponsibility;
        birthDay: Date | null;
        atDate?: Date;
    }): boolean {
        // 1. the responsibility asks for an extract
        if (responsibility.minimumAge === null) {
            return false;
        }

        // 2. the member holds it on atDate
        if (!this.holdsResponsibility(responsibility, atDate)) {
            return false;
        }

        // 3. and has reached its minimum age. Members without a birth day are treated as adults, the same way
        //    MemberDetails.defaultAge does.
        const minimumAgeDate = this.getMinimumAgeDate(birthDay, responsibility.minimumAge);
        return minimumAgeDate === null || minimumAgeDate <= atDate;
    }

    /**
     * The status of the member on `atDate`, with the reason behind it.
     *
     * This is derived instead of stored, so it stays correct when the age of a responsibility changes or when a member
     * gains or loses a responsibility. The status is decided by `requiresExtract`; the reason names the earliest date
     * an extract is (or becomes) required over all the responsibilities the member holds.
     */
    static getRequirement({ birthDay, responsibilities, atDate = new Date() }: {
        birthDay: Date | null;
        responsibilities: JudicialRecordResponsibility[];
        atDate?: Date;
    }): JudicialRecordRequirement {
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
            return {
                status,
                description: $t(`Geen enkele functie van dit lid vraagt een uittreksel uit het strafregister.`),
            };
        }

        if (status === JudicialRecordStatus.Required) {
            return {
                status,
                description: $t(`Vereist sinds {date}`, { date: Formatter.date(requiredFrom, true) }),
            };
        }

        // Responsibilities that didn't start yet are skipped, so a date in the future can only mean the member is
        // still too young.
        const date = Formatter.date(requiredFrom, true);

        return {
            status,
            description: requiredFromAge !== null
                ? $t(`Vereist vanaf {date} ({ordinal} verjaardag)`, { date, ordinal: Formatter.ordinalNumber(requiredFromAge) })
                : $t(`Vereist vanaf {date}`, { date }),
        };
    }
}
