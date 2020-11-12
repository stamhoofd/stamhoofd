import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, ConvertArrayToPatchableArray, Data, DateDecoder, Decoder, EnumDecoder, field, IntegerDecoder, Patchable, PatchableArrayAutoEncoder, PatchableDecoder, PatchType, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Address } from '../Address';
import { Image } from '../files/Image';
import { PaymentMethod } from '../PaymentMethod';

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

    static sort(a: WebshopTimeSlot, b: WebshopTimeSlot){
        const aa = Formatter.dateIso(a.date)+" "+Formatter.minutesPadded(a.startTime)+" "+Formatter.minutesPadded(a.endTime)
        const bb = Formatter.dateIso(b.date)+" "+Formatter.minutesPadded(b.startTime)+" "+Formatter.minutesPadded(b.endTime)
        if (aa < bb) {
            return -1
        }
        if (aa > bb) {
            return 1
        }
        return 0
    }
}

/**
 * Configuration to keep track of available time slots. Can be a fixed number or an infinite amount of time slots
 */
export class WebshopTimeSlots extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(WebshopTimeSlot) })
    timeSlots: WebshopTimeSlot[] = []
}


export enum CheckoutMethodType {
    "Takeout" = "Takeout",
    "Delivery" = "Delivery"
}

export class CheckoutMethod extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(CheckoutMethodType) })
    type: CheckoutMethodType

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: WebshopTimeSlots })
    timeSlots: WebshopTimeSlots = WebshopTimeSlots.create({})
}

export class WebshopTakeoutMethod extends CheckoutMethod {
    @field({ decoder: new EnumDecoder(CheckoutMethodType), patchDefaultValue: () => CheckoutMethodType.Takeout }) // patchDefaultVAlue -> to include this value in all patches and make sure we can recognize the type of the patch
    type: CheckoutMethodType.Takeout = CheckoutMethodType.Takeout

    @field({ decoder: Address })
    address: Address
}

export class WebshopDeliveryMethod extends CheckoutMethod {
    @field({ decoder: new EnumDecoder(CheckoutMethodType), patchDefaultValue: () => CheckoutMethodType.Delivery }) // patchDefaultVAlue -> to include this value in all patches and make sure we can recognize the type of the patch
    type: CheckoutMethodType.Delivery = CheckoutMethodType.Delivery

    // todo: add supported region here
    // todo: add delivery costs here (could also add it to checkout method and make it general)
}

export type AnyCheckoutMethod = WebshopTakeoutMethod | WebshopDeliveryMethod
export type AnyCheckoutMethodPatch = AutoEncoderPatchType<WebshopTakeoutMethod> | AutoEncoderPatchType<WebshopDeliveryMethod>

export class AnyCheckoutMethodPatchDecoder {
    static decode(data: Data): AnyCheckoutMethodPatch {
        const base = data.decode(CheckoutMethod.patchType() as Decoder<AutoEncoderPatchType<CheckoutMethod>>)
        if (base.type == CheckoutMethodType.Takeout) {
            return WebshopTakeoutMethod.patchType().decode(data)
        }

        if (base.type == CheckoutMethodType.Delivery) {
            return WebshopDeliveryMethod.patchType().decode(data)
        }

        throw new SimpleError({
            code: "invalid_field",
            message: "Unsupported checkout type in patch. Make sure checkout type is always set when patching.",
            field: data.addToCurrentField("type")
        })
    }

    static patchType(): PatchableDecoder<AnyCheckoutMethodPatchDecoder> {
        // We never allow patches on this type
        return AnyCheckoutMethodPatchDecoder
    }

}

export class AnyCheckoutMethodDecoder {
    static decode(data: Data): AnyCheckoutMethod {
        const base = data.decode(CheckoutMethod as Decoder<CheckoutMethod>)
        if (base.type == CheckoutMethodType.Takeout) {
            return WebshopTakeoutMethod.decode(data)
        }

        if (base.type == CheckoutMethodType.Delivery) {
            return WebshopDeliveryMethod.decode(data)
        }

        throw new SimpleError({
            code: "invalid_field",
            message: "Unsupported checkout type",
            field: data.addToCurrentField("type")
        })
    }

    static patchType(): PatchableDecoder<AnyCheckoutMethodPatch> {
        // We never allow patches on this type
        return AnyCheckoutMethodPatchDecoder
    }

    static patchIdentifier(): Decoder<string> {
        // We never allow patches on this type
        return StringDecoder
    }
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

    @field({ decoder: new ArrayDecoder(AnyCheckoutMethodDecoder) })
    checkoutMethods: CheckoutMethod[] = []

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)), version: 41 })
    paymentMethods: PaymentMethod[] = [PaymentMethod.Transfer]

    @field({ decoder: StringDecoder, nullable: true, version: 42 })
    iban: string | null = null

    @field({ decoder: DateDecoder, nullable: true, version: 43 })
    availableUntil: Date | null = null
}

export class WebshopPrivateMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    placeholder = ""
}

export class WebshopServerMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    placeholder = ""
}