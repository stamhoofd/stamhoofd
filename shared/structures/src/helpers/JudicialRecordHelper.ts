import { Formatter } from '@stamhoofd/utility';
import type { Organization } from '../Organization.js';
import type { Platform } from '../Platform.js';
import { hasJudicialRecordFeature } from './judicialRecordFeature.js';

/**
 * The judicial record status of a member: what the rest of the system acts on.
 *
 * Every status the feature will ever have is here from the start, so a call site that switches on one does
 * not have to be found again later. Only `NotRequired` and `Required` are reached until a member can
 * actually deliver an extract; the delivered outcomes follow further down the stack.
 *
 * The delivered outcomes live here rather than in an enum of their own so that a member has one judicial
 * record status, not two that have to be combined at every call site. Each outcome a reviewer can give keeps
 * its own value: a rejection for good is not a rejection for now, and an acceptance under conditions is not
 * an unconditional one, so neither is collapsed into the other.
 *
 * A member may act when the status is `NotRequired`, `Ok` or `ConditionallyAccepted`; the rest block. Ask it
 * that way round: "is it one of the three", never "is it `Required`", or a fifth blocking value would
 * silently start permitting the thing it was added to prevent.
 */
export enum JudicialRecordStatus {
    /** The member doesn't have to have a judicial record extract checked. */
    NotRequired = 'NotRequired',

    /** The member has to have a judicial record extract checked. */
    Required = 'Required',

    /** An extract was delivered and a reviewer has to look at it. */
    UnderReview = 'UnderReview',

    /** A reviewer refused the extract for now: the member has to deliver another one. */
    TemporarilyRejected = 'TemporarilyRejected',

    /** A reviewer refused the extract for good. */
    PermanentlyRejected = 'PermanentlyRejected',

    /** An extract was accepted, under conditions a reviewer wrote down. */
    ConditionallyAccepted = 'ConditionallyAccepted',

    /** An extract was accepted. */
    Ok = 'Ok',
}

/**
 * A status with the reason behind it, so a member view can explain why an extract is (not) required.
 */
export interface JudicialRecordForMember {
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
     *
     * This is also where the feature flag is answered: everything the feature shows or asks for hangs off this
     * one question, so turning the flag off hides all of it without a second check anywhere else.
     */
    static asksForExtract({
        platform,
        organization,
    }: {
        platform: Platform;
        organization?: Organization | null;
    }): boolean {
        if (!hasJudicialRecordFeature({ platform, organization })) {
            return false;
        }

        return [
            ...platform.config.responsibilities,
            ...(organization?.privateMeta?.responsibilities ?? []),
        ].some((responsibility) => responsibility.judicialRecordMinimumAge !== null);
    }

    static getStatusName(status: JudicialRecordStatus): string {
        switch (status) {
            case JudicialRecordStatus.Required:
                return $t(`Vereist`);
            case JudicialRecordStatus.NotRequired:
                return $t(`Niet vereist`);
            case JudicialRecordStatus.UnderReview:
                return $t(`Wordt beoordeeld`);
            case JudicialRecordStatus.TemporarilyRejected:
                return $t(`Tijdelijk afgekeurd`);
            case JudicialRecordStatus.PermanentlyRejected:
                return $t(`Definitief afgekeurd`);
            case JudicialRecordStatus.ConditionallyAccepted:
                return $t(`Goedgekeurd onder voorwaarden`);
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
    static holdsResponsibility(
        responsibility: JudicialRecordResponsibility,
        atDate: Date,
    ): boolean {
        return (
            responsibility.startDate <= atDate &&
            (responsibility.endDate === null || responsibility.endDate > atDate)
        );
    }

    /**
     * Whether this single responsibility requires the member to have an extract checked on `atDate`.
     */
    static requiresExtract({
        responsibility,
        birthDay,
        atDate = new Date(),
    }: {
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
    static getForMember({
        firstName,
        birthDay,
        responsibilities,
        atDate = new Date(),
    }: {
        /** Used in the description, so it talks about the member by name. */
        firstName: string;
        birthDay: Date | null;
        responsibilities: JudicialRecordResponsibility[];
        atDate?: Date;
    }): JudicialRecordForMember {
        const status = responsibilities.some((responsibility) =>
            this.requiresExtract({ responsibility, birthDay, atDate }),
        )
            ? JudicialRecordStatus.Required
            : JudicialRecordStatus.NotRequired;

        /** The earliest date an extract is required from, over the responsibilities the member holds on `atDate`. */
        let requiredFrom: Date | null = null;

        /** The minimum age that decides `requiredFrom`, null when the start of the responsibility decides it. */
        let requiredFromAge: number | null = null;

        for (const responsibility of responsibilities) {
            if (
                responsibility.minimumAge === null ||
                !this.holdsResponsibility(responsibility, atDate)
            ) {
                continue;
            }

            const minimumAgeDate = this.getMinimumAgeDate(birthDay, responsibility.minimumAge);
            const reachesAgeLater =
                minimumAgeDate !== null && minimumAgeDate > responsibility.startDate;
            const date = reachesAgeLater ? minimumAgeDate : responsibility.startDate;

            if (requiredFrom === null || date < requiredFrom) {
                requiredFrom = date;
                requiredFromAge = reachesAgeLater ? responsibility.minimumAge : null;
            }
        }

        if (requiredFrom === null) {
            if (
                !responsibilities.some((responsibility) =>
                    this.holdsResponsibility(responsibility, atDate),
                )
            ) {
                return {
                    status,
                    description: $t(`{name} heeft geen functies.`, { name: firstName }),
                };
            }

            return {
                status,
                description: $t(
                    `Geen enkele functie van {name} vraagt een uittreksel uit het strafregister.`,
                    { name: firstName },
                ),
            };
        }

        const date = Formatter.date(requiredFrom, true);

        if (requiredFromAge !== null) {
            const ordinal = Formatter.ordinalNumber(requiredFromAge);

            return {
                status,
                description:
                    status === JudicialRecordStatus.Required
                        ? $t(`Sinds {date}, de {ordinal} verjaardag van {name}.`, {
                              date,
                              ordinal,
                              name: firstName,
                          })
                        : $t(`Vanaf {date}, de {ordinal} verjaardag van {name}.`, {
                              date,
                              ordinal,
                              name: firstName,
                          }),
            };
        }

        return {
            status,
            description:
                status === JudicialRecordStatus.Required
                    ? $t(`Sinds {date}, de startdatum van de functie.`, { date })
                    : $t(`Vanaf {date}, de startdatum van de functie.`, { date }),
        };
    }
}
