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
     * Whether the member has to have their judicial record extract checked on `atDate`, with the reason behind it.
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
            if (!responsibilities.some(responsibility => this.holdsResponsibility(responsibility, atDate))) {
                return {
                    status,
                    description: $t(`Dit lid heeft geen functies.`),
                };
            }

            return {
                status,
                description: $t(`Geen enkele functie van dit lid vraagt een uittreksel uit het strafregister.`),
            };
        }

        const date = Formatter.date(requiredFrom, true);

        if (requiredFromAge !== null) {
            const ordinal = Formatter.ordinalNumber(requiredFromAge);

            return {
                status,
                description: status === JudicialRecordStatus.Required
                    ? $t(`Sinds {date}, de {ordinal} verjaardag van dit lid.`, { date, ordinal })
                    : $t(`Vanaf {date}, de {ordinal} verjaardag van dit lid.`, { date, ordinal }),
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
