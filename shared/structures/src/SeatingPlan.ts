import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class SeatingPlanSeat extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the seat
     */
    @field({ decoder: StringDecoder })
    name = ""
}

export class SeatingPlanRow extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the row
     */
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: new ArrayDecoder(SeatingPlanSeat) })
    seats: SeatingPlanSeat[] = []
}

export class SeatingPlanSection extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the section (optional if only section)
     */
    @field({ decoder: StringDecoder })
    name = ""
}

export class SeatingPlan extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the venue
     */
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: new ArrayDecoder(SeatingPlanSection) })
    sections: SeatingPlanSection[] = []
}
