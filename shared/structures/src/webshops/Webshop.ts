import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Category } from './Category';
import { Product } from './Product';
import { WebshopMetaData, WebshopPrivateMetaData } from './WebshopMetaData';

export class WebshopPreview extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: WebshopMetaData })
    meta = WebshopMetaData.create({})
}

export class Webshop extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: WebshopMetaData })
    meta = WebshopMetaData.create({})

    @field({ decoder: new ArrayDecoder(Product) })
    products: Product[] = []

    @field({ decoder: new ArrayDecoder(Category) })
    categories: Category[] = []
}

export class PrivateWebshop extends Webshop {
    @field({ decoder: WebshopPrivateMetaData })
    privateMeta = WebshopPrivateMetaData.create({})
}

