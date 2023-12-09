import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Product } from './webshops/Product';
import { Webshop, WebshopPreview } from './webshops/Webshop';

export class SeatingSizeConfiguration {
    seatWidth = 30
    seatHeight = 30
    seatXSpacing = 10
    seatYSpacing = 10

    constructor(config?: Partial<SeatingSizeConfiguration>) {
        Object.assign(this, config)
    }
}

export enum SeatMarkings {
    DisabledPerson = "dp",
}

export enum SeatType {
    Seat = "s",
    Space = "sp"
}

type Size = {
    width: number
    height: number
}

// Note: we don't use ids for seats and rows
// 1. To make changes easier (human understandable if seats are moved added or removed)
// 2. To avoid creating huge objects that take a lot of space in the database/network requests

export class SeatingPlanSeat extends AutoEncoder {
    /**
     * Name of the seat.
     * E.g. '1'
     */
    @field({ decoder: StringDecoder })
    id = ""

    /**
     * Default block width = 2, which equals 1 seat -> allow to jump in halves
     */
    @field({ decoder: IntegerDecoder, field: 'w', optional: true })
    blockWidth = 2

    /**
     * Grow factor (automatically increase width of seat)
     */
    @field({ decoder: IntegerDecoder, field: 'g', optional: true })
    grow = 0

    @field({ decoder: new EnumDecoder(SeatType), field: 't', optional: true })
    type = SeatType.Seat

    @field({ decoder: new ArrayDecoder(new EnumDecoder(SeatMarkings)), optional: true, field: 'm' })
    markings: SeatMarkings[] = []

    get isSpace() {
        return this.type === SeatType.Space
    }

    // Cached drawing position
    x = 0;
    y = 0;
    width = 0;
    height = 0;

    setPosition(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // Unique id for rendering
    uuid = uuidv4();
}

export class SeatingPlanRow extends AutoEncoder {
    /**
     * Name of the row
     * E.g. 'A'
     */
    @field({ decoder: StringDecoder })
    id = ""

    @field({ decoder: new ArrayDecoder(SeatingPlanSeat) })
    seats: SeatingPlanSeat[] = []

    getWidth(config: SeatingSizeConfiguration) {
        if (this.seats.length === 0) {
            return config.seatWidth;
        }

        let width = -config.seatXSpacing;
        for (const seat of this.seats) {
            width += config.seatWidth * seat.blockWidth / 2 + config.seatXSpacing + Math.floor(config.seatXSpacing * (seat.blockWidth - 2) / 2)
            
        }
        return width;
    }

    getGrow() {
        let grow = 0;
        for (const seat of this.seats) {
            grow += seat.grow
        }
        return grow;
    }

    // Cached drawing positions
    x = 0;
    y = 0;
    height = 0;
    width = 0;

    setPosition(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // Unique id for rendering
    uuid = uuidv4();
}

export class SeatingPlanSection extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of the section (optional if only section)
     */
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: new ArrayDecoder(SeatingPlanRow) })
    rows: SeatingPlanRow[] = []

    calculateSize(config: SeatingSizeConfiguration): Size {
        const size = {
            width: 0,
            height: this.rows.length * config.seatHeight + config.seatYSpacing * (this.rows.length - 1)
        }

        for (const row of this.rows) {
            size.width = Math.max(size.width, row.getWidth(config))
        }

        return size
    
    }

    updatePositions(config: SeatingSizeConfiguration) {
        const size = this.calculateSize(config)

        let y = 0;
        for (const row of this.rows) {
            const rowWidth = row.getWidth(config)
            const rowGrow = row.getGrow()
            const rowX = rowGrow > 0 ? 0 : (size.width/2 - rowWidth/2);
            const rowY = y;
            let x = rowX;
            

            for (const seat of row.seats) {
                const w = config.seatWidth * seat.blockWidth / 2 + Math.floor(config.seatXSpacing * (seat.blockWidth - 2) / 2) + (rowGrow > 0 ? Math.max(0, seat.grow * (size.width - rowWidth) / rowGrow) : 0)
                seat.setPosition(x, y, w, config.seatHeight)
                x += w + config.seatXSpacing
            }

            y += config.seatHeight
            row.setPosition(rowX, rowY, rowGrow > 0 ? size.width : rowWidth, y - rowY)
            
            // Add spacing
            y += config.seatYSpacing
        }
    
    }
}

export class SeatingPlan extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of the venue
     */
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: new ArrayDecoder(SeatingPlanSection) })
    sections: SeatingPlanSection[] = [SeatingPlanSection.create({})]
}

export class ReservedSeat extends AutoEncoder {
    /**
     * Id of the section
     */
    @field({ decoder: StringDecoder })
    sId = ""

    /**
     * Name of the row
     */
    @field({ decoder: StringDecoder })
    r = ""

    /**
     * Name of the seat
     */
    @field({ decoder: StringDecoder })
    s = ""

    getName(webshop: Webshop|WebshopPreview, product: Product): {title: string, value: string}[] {
        if (!product.seatingPlanId) {
            return []
        }
        const seatingPlan = webshop.meta.seatingPlans.find(p => p.id === product.seatingPlanId)
        if (!seatingPlan) {
            return []
        }

        const section = seatingPlan.sections.find(s => s.id === this.sId)

        if (seatingPlan.sections.length === 1 || !section) {
            // Don't mention the section
            return [
                {
                    title: 'Rij',
                    value: this.r
                },
                {
                    title: 'Zetel',
                    value: this.s
                }
            ]
        }

        return [
            {
                title: 'Sectie',
                value: section.name
            },
            {
                title: 'Rij',
                value: this.r
            },
            {
                title: 'Zetel',
                value: this.s
            }
        ];
    }

    getNameString(webshop: Webshop|WebshopPreview, product: Product) {
        return this.getName(webshop, product).map(p => p.title+': '+p.value).join(', ')
    }

    equals(reservedSeat: ReservedSeat) {
        return this.sId === reservedSeat.sId && this.r === reservedSeat.r && this.s === reservedSeat.s
    }
}