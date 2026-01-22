import { AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { BooleanStatus } from './MemberDetails.js';

/**
 * Possibles status returned from uitpas api
 * https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-pass
 */
export enum UitpasSocialTariffStatus {
    // if the status has not been checked yet
    Unknown = 'Unknown',

    // status returned from uitpas api
    Active = 'Active',
    Expired = 'Expired',
    None = 'None',
}

/**
* Data returned from uitpas api.
* https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-pass
*/
export class UitpasSocialTariff extends AutoEncoder {
    @field({ decoder: new EnumDecoder(UitpasSocialTariffStatus) })
    status: UitpasSocialTariffStatus;

    /**
     * Exact expiration date of the passholder's entitlement to a social tariff. This property must not be used to determine the social tariff status, because status can be ACTIVE while the endDate is in the past during a 'grace period'. This property is not available when status is NONE.
     */
    @field({ decoder: DateDecoder, nullable: true })
    endDate: Date | null = null;

    // todo: use for performance and set (only check if not updated recently)
    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    /**
     * Whether the social tariff should be updated
     */
    get shouldUpdate(): boolean {
        // always check if status is unknown
        if (this.status === UitpasSocialTariffStatus.Unknown) {
            return true;
        }

        const now = new Date();

        // always check if endDate is expired
        if (this.endDate !== null && this.endDate.getTime() < now.getTime()) {
            return true;
        }

        // todo -> change to 1 day
        // should check if updated more than 30 minutes ago
        const halfHourInMs = 1800000;
        return now.getTime() - this.updatedAt.getTime() > halfHourInMs;
    }

    get isActive(): boolean {
        return this.status === UitpasSocialTariffStatus.Active;
    }

    /**
     * Whether a social tariff update is required for saving or registering the member.
     * @param requiresFinancialSupport
     * @returns
     */
    isUpdateRequired(requiresFinancialSupport: BooleanStatus | null): boolean {
        const status = this.status;

        // a successfull check is always required if we never received a response from uitpas api before
        if (status === UitpasSocialTariffStatus.Unknown) {
            return true;
        }

        // does not matter if financial support is required
        if (requiresFinancialSupport?.value === true) {
            return false;
        }

        // a successfull check is always required if the status is active but the endDate is expired (we don't know the new status)
        if (status === UitpasSocialTariffStatus.Active) {
            const now = new Date();

            // should check if expired
            if (this.endDate !== null && this.endDate.getTime() < now.getTime()) {
                return true;
            }
        }

        return false;
    }
}

export class UitpasNumberDetails extends AutoEncoder {
    @field({ decoder: StringDecoder })
    uitpasNumber: string;

    @field({ decoder: UitpasSocialTariff })
    socialTariff: UitpasSocialTariff = UitpasSocialTariff.create({
        status: UitpasSocialTariffStatus.Unknown,
    });
}
