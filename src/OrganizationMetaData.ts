import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';

import { OrganizationType } from './OrganizationType';
import { UmbrellaOrganization } from './UmbrellaOrganization';

export class OrganizationMetaData extends AutoEncoder {
    @field({ decoder: new EnumDecoder(OrganizationType) })
    type: OrganizationType;

    @field({ decoder: new EnumDecoder(UmbrellaOrganization), nullable: true })
    umbrellaOrganization: UmbrellaOrganization | null = null;
}
