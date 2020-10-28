import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class WebshopMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""
}

export class WebshopPrivateMetaData extends AutoEncoder {

}

export class WebshopServerMetaData extends AutoEncoder {

}