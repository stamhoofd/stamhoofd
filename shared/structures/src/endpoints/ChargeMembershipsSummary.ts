import { AutoEncoder, IntegerDecoder, field } from "@simonbackx/simple-encoding";

export class ChargeMembershipsSummary extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    memberships = 0;

    @field({ decoder: IntegerDecoder })
    members = 0;

    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: IntegerDecoder })
    organizations = 0;
}
