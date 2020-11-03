import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Address } from '../Address';
import { Image } from '../files/Image';

export class WebshopTimeSlot extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    /**
     * Day. The time is ignored, and timezone should be same timezone as the webshop/organization
     */
    @field({ decoder: DateDecoder })
    date: Date

    /**
     * Saved in minutes since midnight
     */
    @field({ decoder: IntegerDecoder })
    startTime: number = 12*60

    /**
     * Saved in minutes since midnight
     */
    @field({ decoder: IntegerDecoder })
    endTime: number = 14*60
}

/**
 * Configuration to keep track of available time slots. Can be a fixed number or an infinite amount of time slots
 */
export class WebshopTimeSlots extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(WebshopTimeSlot) })
    timeSlots: WebshopTimeSlot[] = []
}

export class WebshopTakeoutLocation extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: Address })
    address: Address

    @field({ decoder: WebshopTimeSlots })
    timeSlots: WebshopTimeSlots = WebshopTimeSlots.create({})
}

/*
export class WebshopDeliveryCity extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    postalCode = ""

    @field({ decoder: new ArrayDecoder(WebshopDeliveryCity) })
    children: WebshopDeliveryCity[] = [] // If subcities are included (should be reachable immediately during validation!)
}

export class WebshopDeliveryOption extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: new ArrayDecoder(WebshopTimeSlot) })
    timeSlots: WebshopTimeSlot[] = []

    @field({ decoder: IntegerDecoder })
    deliveryPrice = 0

    @field({ decoder: IntegerDecoder, nullable: true })
    deliveryPriceDiscountMinimumPrice: number | null = null

    /**
     * Ignore if deliveryPriceDiscountMinimumPrice is null
     */
    /*@field({ decoder: IntegerDecoder })
    deliveryPriceDiscount = 0


}*/


export class WebshopMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    title = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: Image, nullable: true })
    coverPhoto: Image | null = null

    @field({ decoder: new ArrayDecoder(WebshopTakeoutLocation), defaultValue: () => [] })
    takeoutLocations: WebshopTakeoutLocation[] = []
}

export class WebshopPrivateMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    placeholder = ""
}

export class WebshopServerMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    placeholder = ""
}