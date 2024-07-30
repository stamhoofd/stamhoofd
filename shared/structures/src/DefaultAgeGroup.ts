import { ArrayDecoder, AutoEncoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding"
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { OrganizationRecordsConfiguration } from "./members/OrganizationRecordsConfiguration";

export class DefaultAgeGroup extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    names: string[] = ['']

    @field({ decoder: StringDecoder, optional: true})
    description = ''

    @field({ decoder: IntegerDecoder, nullable: true })
    minAge: number | null = null

    @field({ decoder: IntegerDecoder, nullable: true })
    maxAge: number | null = null

    /**
     * Members registered in this age group, will be assigned to this membership type by default
     */
    @field({ decoder: StringDecoder, nullable: true, version: 269 })
    defaultMembershipTypeId: string | null = null

    get name() {
        return Formatter.joinLast(this.names, ', ', ' of ')
    }

    @field({ 
        decoder: OrganizationRecordsConfiguration, 
        version: 293,
        defaultValue: () => OrganizationRecordsConfiguration.create({})
    })
    recordsConfiguration: OrganizationRecordsConfiguration

}
