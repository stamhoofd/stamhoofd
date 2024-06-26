import { ArrayDecoder, AutoEncoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding"
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

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

    get name() {
        return Formatter.joinLast(this.names, ', ', ' of ')
    }
}