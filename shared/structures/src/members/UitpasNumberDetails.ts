import { AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { BooleanStatus } from './MemberDetails.js';
import { DataValidator } from '@stamhoofd/utility';

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

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    get isActive(): boolean {
        return this.status === UitpasSocialTariffStatus.Active;
    }

    /**
     * @returns true if updated more than 1 week ago
     */
    isUpdateOutdated(): boolean {
        const now = new Date();

        // should check if updated more than 1 week ago
        const weekInMs = 604800000;
        return now.getTime() - this.updatedAt.getTime() > weekInMs;
    }

    /**
     * Whether a social tariff update is required for saving or registering the member.
     * @param requiresFinancialSupport
     * @returns
     */
    shouldUpdateForRegsitration(requiresFinancialSupport: BooleanStatus | null): boolean {
        // does not matter if financial support is required
        if (requiresFinancialSupport?.value === true) {
            return false;
        }

        if (this.status === UitpasSocialTariffStatus.Unknown) {
            return true;
        }

        return this.isUpdateOutdated();
    }
}

export class UitpasNumberDetails extends AutoEncoder {
    @field({ decoder: StringDecoder })
    uitpasNumber: string;

    @field({ decoder: UitpasSocialTariff })
    socialTariff: UitpasSocialTariff = UitpasSocialTariff.create({
        status: UitpasSocialTariffStatus.Unknown,
    });

    get isActive(): boolean {
        if (this.socialTariff.status === UitpasSocialTariffStatus.Active) {
            return true;
        }

        // Fallback to legacy check if unknown
        if (this.socialTariff.status === UitpasSocialTariffStatus.Unknown && this.uitpasNumber) {
            if (DataValidator.isUitpasNumberKansenTarief(this.uitpasNumber)) {
                return true;
            }
        }

        return false;
    }
}
