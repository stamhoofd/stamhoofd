import { ArrayDecoder,AutoEncoder, DateDecoder,EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { File } from './files/File';
import { Image } from './files/Image';
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

    @field({ decoder: StringDecoder, version: 6, upgrade: () => "" })
    iban = ""

    /**
     * Logo used in a horizontal environment (e.g. menu bar)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    horizontalLogo: Image | null = null

    /**
     * Set either file or url for the privacy policy. If both are set, the url has priority
     */
    @field({ decoder: File, nullable: true, version: 25 })
    privacyPolicyFile: File | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 25 })
    privacyPolicyUrl: string | null = null

    /**
     * Logo to display (small)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    squareLogo: Image | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 21 })
    color: string | null = null

    // Deprecated
    @field({ decoder: StringDecoder, version: 6, optional: true, upgrade: () => "" })
    bic = ""

    
}
