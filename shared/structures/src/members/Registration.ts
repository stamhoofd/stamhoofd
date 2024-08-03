import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";
import { Group } from '../Group';
import { StockReservation } from '../StockReservation';

export class Registration extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4()  })
    id: string

    // Group price that was chosen
    // @field({ decoder: GroupPrice, version: 266 })
    // groupPrice: GroupPrice

    // options that were chosen
    // @field({ decoder: new ArrayDecoder(RegisterItemOption), version: 266 })
    // options: RegisterItemOption[] = []

    @field({ decoder: Group, version: 266 })
    group: Group

    get groupId() {
        return this.group.id
    }

    @field({ decoder: StringDecoder, version: 250 })
    organizationId: string

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder })
    cycle: number = 0

    /// Set registeredAt to null if the member is on the waiting list for now
    @field({ decoder: DateDecoder, nullable: true })
    registeredAt: Date | null = null

    /// Keep spot for this member temporarily
    @field({ decoder: DateDecoder, nullable: true })
    reservedUntil: Date | null = null

    /**
     * Currently not yet used
     */
    @field({ decoder: DateDecoder, nullable: true })
    deactivatedAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date()

    /**
     * @deprecated - replaced by group type
     */
    @field({ decoder: BooleanDecoder, version: 16 })
    waitingList = false

    @field({ decoder: BooleanDecoder, version: 20 })
    canRegister = false

    @field({ decoder: IntegerDecoder, optional: true })
    price = 0

    @field({ decoder: IntegerDecoder, optional: true })
    pricePaid = 0

    @field({ decoder: new ArrayDecoder(StockReservation), nullable: true, version: 299 })
    stockReservations: StockReservation[] = []
}
