import { Data } from "@stamhoofd-common/encoding/src/classes/Data";
import { EnumDecoder } from "@stamhoofd-common/encoding/src/structs/EnumDecoder";
import { Encodeable } from "@stamhoofd-common/encoding/src/classes/Encodeable";

export enum OrganizationType {
    Youth = "youth",
    Football = "football",
    Tennis = "football",
    Student = "student",
    Other = "other",
}

export enum UmbrellaOrganization {
    ScoutsEnGidsenVlaanderen = "Scouts & Gidsen Vlaanderen",
    ChiroNationaal = "Chiro",
}

const organizationTypeDecoder = new EnumDecoder(OrganizationType);
const umbrellaOrganizationDecoder = new EnumDecoder(UmbrellaOrganization);

export class OrganizationMetaStruct implements Encodeable {
    type: OrganizationType;
    umbrellaOrganization: UmbrellaOrganization | undefined;

    static decode(data: Data): OrganizationMetaStruct {
        const s = new OrganizationMetaStruct();
        s.type = data.optionalField("type")?.decode(organizationTypeDecoder) || OrganizationType.Other;
        s.umbrellaOrganization = data.optionalField("umbrellaOrganization")?.decode(umbrellaOrganizationDecoder);
        return s;
    }

    encode(): any {
        // No transformations needed right now
        return this;
    }
}
