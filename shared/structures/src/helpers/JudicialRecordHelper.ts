import { Formatter } from '@stamhoofd/utility';
import { JudicialRecordReviewStatus } from '../members/JudicialRecordReview.js';
import type { Organization } from '../Organization.js';
import type { Platform } from '../Platform.js';

/**
 * The judicial record status of a member: what the rest of the system acts on.
 *
 * The delivered outcomes live here rather than in an enum of their own so that a member has one judicial
 * record status, not two that have to be combined at every call site. Several `JudicialRecordReviewStatus`
 * outcomes collapse into one value here; which outcome it was stays on the record.
 *
 * A member may act when the status is `NotRequired` or `Ok`. `Required`, `UnderReview` and `Rejected` all
 * block. Ask it that way round: "is it `Ok` or `NotRequired`", never "is it `Required`", or a fourth blocking
 * value would silently start permitting the thing it was added to prevent.
 */
export enum JudicialRecordStatus {
    /** The member doesn't have to have a judicial record extract checked. */
    NotRequired = 'NotRequired',

    /** The member has to have a judicial record extract checked. */
    Required = 'Required',

    /** An extract was delivered and a reviewer has to look at it. */
    UnderReview = 'UnderReview',

    /** A reviewer refused the extract, for now or for good. */
    Rejected = 'Rejected',

    /** An extract was accepted, with or without conditions. */
    Ok = 'Ok',
}

/** How long a reviewer's decision stands before the member has to deliver again. */
export const JUDICIAL_RECORD_VALIDITY_YEARS = 3;

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

/**
 * The member's current judicial record, reduced to what decides their status.
 *
 * `identityMatches` is the comparison of the record's identity hash against the member's, done in the database:
 * the hash is never derived in TypeScript, so this helper is told the answer rather than working it out.
 */
export interface JudicialRecordCurrentRecord {
    reviewStatus: JudicialRecordReviewStatus;
    identityMatches: boolean;

    /** When a reviewer decided, null while nobody has looked. */
    reviewedAt: Date | null;
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
            case JudicialRecordStatus.Rejected:
                return $t(`Afgekeurd`);
            case JudicialRecordStatus.Ok:
                return $t(`OK`);
        }
    }

    /**
     * The status a member's current record gives them, or null when the record does not decide it.
     *
     * Null means fall back to the responsibilities: there is no usable record, so the member is in the same
     * position as one who never delivered.
     */
    static getStoredStatus(record: JudicialRecordCurrentRecord | null, atDate: Date = new Date()): JudicialRecordStatus | null {
        if (record === null) {
            return null;
        }

        // The approval was granted to a different name or birth date, so it says nothing about this member.
        if (!record.identityMatches) {
            return null;
        }

        switch (record.reviewStatus) {
            case JudicialRecordReviewStatus.UnderReview:
                // Nobody has looked yet, so there is no decision to expire.
                return JudicialRecordStatus.UnderReview;

            case JudicialRecordReviewStatus.TemporarilyRejected:
                // The member has to deliver another extract, which is what Rejected already asks of them, so
                // there is nothing for an expiry to change.
                return JudicialRecordStatus.Rejected;

            case JudicialRecordReviewStatus.Ok:
            case JudicialRecordReviewStatus.ConditionallyAccepted:
                return this.hasExpired(record.reviewedAt, atDate) ? null : JudicialRecordStatus.Ok;

            case JudicialRecordReviewStatus.PermanentlyRejected:
                return this.hasExpired(record.reviewedAt, atDate) ? null : JudicialRecordStatus.Rejected;
        }
    }

    /** Whether a decision taken on `reviewedAt` no longer stands. A record nobody decided cannot expire. */
    static hasExpired(reviewedAt: Date | null, atDate: Date = new Date()): boolean {
        if (reviewedAt === null) {
            return false;
        }

        return Formatter.luxon(reviewedAt).startOf('day').plus({ years: JUDICIAL_RECORD_VALIDITY_YEARS }).toJSDate() <= atDate;
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
    static getStatus({ firstName, birthDay, responsibilities, record = null, atDate = new Date() }: {
        /** Used in the description, so it talks about the member by name. */
        firstName: string;
        birthDay: Date | null;
        responsibilities: JudicialRecordResponsibility[];

        /** The member's current record, when they have one. */
        record?: JudicialRecordCurrentRecord | null;
        atDate?: Date;
    }): JudicialRecordStatusWithReason {
        const requiresExtract = responsibilities.some(responsibility => this.requiresExtract({ responsibility, birthDay, atDate }));

        // A delivered outcome only says anything while an extract is actually required: a member who no longer
        // holds a responsibility that asks for one is NotRequired, whatever they delivered before.
        const stored = requiresExtract ? this.getStoredStatus(record, atDate) : null;

        const status = stored
            ?? (requiresExtract ? JudicialRecordStatus.Required : JudicialRecordStatus.NotRequired);

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
                description: requiresExtract
                    ? $t(`Sinds {date}, de {ordinal} verjaardag van {name}.`, { date, ordinal, name: firstName })
                    : $t(`Vanaf {date}, de {ordinal} verjaardag van {name}.`, { date, ordinal, name: firstName }),
            };
        }

        return {
            status,
            description: requiresExtract
                ? $t(`Sinds {date}, de startdatum van de functie.`, { date })
                : $t(`Vanaf {date}, de startdatum van de functie.`, { date }),
        };
    }
}
