import { AutoEncoder, IntegerDecoder, MapDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";

export class ChargeMembershipsTypeSummary extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    memberships = 0;

    @field({ decoder: IntegerDecoder })
    members = 0;

    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: IntegerDecoder })
    organizations = 0;
}

export class ChargeMembershipsSummary extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    memberships = 0;

    @field({ decoder: IntegerDecoder })
    members = 0;

    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: IntegerDecoder })
    organizations = 0;

    @field({ decoder: new MapDecoder(StringDecoder, ChargeMembershipsTypeSummary) })
    membershipsPerType = new Map<string, ChargeMembershipsTypeSummary>();
}
