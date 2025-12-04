import { AutoEncoder, BooleanDecoder, IntegerDecoder, MapDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class ChargeMembershipsTypeSummary extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    memberships = 0;

    @field({ decoder: IntegerDecoder })
    members = 0;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    @field({ decoder: IntegerDecoder })
    organizations = 0;
}

export class ChargeMembershipsSummary extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    running = false;

    @field({ decoder: IntegerDecoder })
    memberships = 0;

    @field({ decoder: IntegerDecoder })
    members = 0;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    @field({ decoder: IntegerDecoder })
    organizations = 0;

    @field({ decoder: new MapDecoder(StringDecoder, ChargeMembershipsTypeSummary) })
    membershipsPerType = new Map<string, ChargeMembershipsTypeSummary>();

    @field({ decoder: ChargeMembershipsTypeSummary, version: 355 })
    trials: ChargeMembershipsTypeSummary = ChargeMembershipsTypeSummary.create({});
}
