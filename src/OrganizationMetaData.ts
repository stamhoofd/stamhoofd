import { ArrayDecoder,AutoEncoder, DateDecoder,EnumDecoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

import { GroupPrices } from './GroupPrices';
import { OrganizationGenderType } from './OrganizationGenderType';
import { OrganizationType } from './OrganizationType';
import { UmbrellaOrganization } from './UmbrellaOrganization';

export class OrganizationMetaData extends AutoEncoder {
    @field({ decoder: new EnumDecoder(OrganizationType) })
    type: OrganizationType;

    @field({ decoder: new EnumDecoder(UmbrellaOrganization), nullable: true })
    umbrellaOrganization: UmbrellaOrganization | null = null;

    @field({ decoder: IntegerDecoder })
    expectedMemberCount = 0

    @field({ decoder: new EnumDecoder(OrganizationGenderType) })
    genderType: OrganizationGenderType = OrganizationGenderType.Mixed

    @field({ decoder: DateDecoder })
    defaultStartDate: Date

    @field({ decoder: DateDecoder })
    defaultEndDate: Date

    @field({ decoder: new ArrayDecoder(GroupPrices) })
    defaultPrices: GroupPrices[] = []
}
