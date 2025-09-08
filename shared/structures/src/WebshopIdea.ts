import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

export class WebshopIdea extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name: string = '';

    @field({ decoder: StringDecoder })
    description: string = '';

    @field({ decoder: StringDecoder })
    html: string = '';

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    labels: string[] = [];
}
