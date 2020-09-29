import { AutoEncoder,BooleanDecoder,field,IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';

export class RegistrationPatch extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string
    
    @field({ decoder: StringDecoder, optional: true })
    groupId?: string

    @field({ decoder: IntegerDecoder, optional: true })
    cycle?: number
    
    @field({ decoder: BooleanDecoder, optional: true })
    waitingList?: boolean

    @field({ decoder: BooleanDecoder, optional: true})
    canRegister?: boolean
}