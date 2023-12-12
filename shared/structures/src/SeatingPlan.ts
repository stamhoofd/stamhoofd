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
    @field({ decoder: StringDecoder, field: 'l' })
    label = ""

    /**
     * id of the category of this seat
     */
    @field({ decoder: StringDecoder, field: 'c', optional: true, nullable: true})
    category: string|null

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

    get isValidSeat() {
        return this.type === SeatType.Seat && this.label !== ""
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
    @field({ decoder: StringDecoder, field: 'l' })
    label = ""

    @field({ decoder: new ArrayDecoder(SeatingPlanSeat), field: 's' })
    seats: SeatingPlanSeat[] = []

    get seatCount() {
        let count = 0;
        for (const seat of this.seats) {
            if (seat.isValidSeat) {
                count += 1
            }
        }
        return count;
    }

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

    get seatCount() {
        let count = 0;
        for (const row of this.rows) {
            count += row.seatCount
        }
        return count;
    }

    calculateSize(config: SeatingSizeConfiguration): Size {
        const size = {
            width: config.seatWidth * 10, // = minimum width
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

export class SeatingPlanCategory extends AutoEncoder {
    /**
     * On creation, choose a short id, to reduce the size of the seating plan
     */
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the category
     */
    @field({ decoder: StringDecoder })
    name = ""

    /**
     * Price added (can be negative) is always in cents, to avoid floating point errors
     */
    @field({ decoder: IntegerDecoder })
    price = 0;

    /**
     * Only allow ordering by administrators
     */
    @field({ decoder: BooleanDecoder, version: 218 })
    adminOnly = false;
}

export class SeatingPlan extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of the venue
     */
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: BooleanDecoder, version: 215 })
    requireOptimalReservation = true

    @field({ decoder: new ArrayDecoder(SeatingPlanSection) })
    sections: SeatingPlanSection[] = [SeatingPlanSection.create({})]

    @field({ decoder: new ArrayDecoder(SeatingPlanCategory), version: 214 })
    categories: SeatingPlanCategory[] = []

    get seatCount() {
        let count = 0;
        for (const section of this.sections) {
            count += section.seatCount
        }
        return count;
    }

    get adminSeatCount() {
        let count = 0;
        for (const section of this.sections) {
            for (const row of section.rows) {
                for (const seat of row.seats) {
                    if (seat.isValidSeat) {
                        const category = this.categories.find(c => c.id === seat.category)
                        if (category && category.adminOnly) {
                            count += 1
                        }
                    }
                }
            }
        }
        return count;
    }

    isAdminSeat(s: ReservedSeat) {
        const seat = this.getSeat(s)
        if (!seat) {
            return false;
        }
        const category = this.categories.find(c => c.id === seat.category)
        if (category && category.adminOnly) {
            return true;
        }
        return false;
    }

    getSeat(s: ReservedSeat): SeatingPlanSeat|null {
        for (const section of this.sections) {
            if (section.id === s.section) {
                for (const row of section.rows) {
                    if (row.label === s.row) {
                        for (const seat of row.seats) {
                            if (seat.label === s.seat && seat.isValidSeat) {
                                return seat
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    getCategoryColor(categoryId) {
        const colorIndexes = ['', 'var(--color-secundary)', 'var(--color-tertiary)', 'var(--color-warning)']
        const category = this.categories.findIndex(c => c.id === categoryId)
        if (category) {
            return colorIndexes[category] ?? ''
        }
    }

    getSeatColor(seat: SeatingPlanSeat) {
        if (!seat.isValidSeat) {
            return ""
        }
        if (seat.category) {
            return this.getCategoryColor(seat.category)
        }
        return ""
    }

    isValidSeat(s: ReservedSeat, reservedSeats?: ReservedSeat[], allowedSeats?: ReservedSeat[]) {
        for (const section of this.sections) {
            if (section.id === s.section) {
                for (const row of section.rows) {
                    if (row.label === s.row) {
                        for (const seat of row.seats) {
                            if (seat.label === s.seat && seat.isValidSeat) {

                                if (reservedSeats) {
                                    const isReserved = !!reservedSeats.find(s2 => s2.equals(s))
                                    if (isReserved) {
                                        if (allowedSeats) {
                                            const isAllowed = !!allowedSeats?.find(s2 => s2.equals(s))
                                            return isAllowed
                                        }
                                        return false
                                    }
                                }

                                return true
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    adjustSeatsForBetterFit(selectedSeats: ReservedSeat[], reservedSeats: ReservedSeat[], allowedSeats: ReservedSeat[] = [], asAdmin = false): ReservedSeat[]|null {
        // A seat is valid if it is next to a different reserved seat.
        // If above is not true, then it can also be invalid if there is one seat between the next reserved seat
        // Otherwise it is valid

        // Algo steps:
        // 1. Loop each row
        // 2. Check if the seat is taken or a space
        // 3. Count empty seats in a row
        // If we find first selected seat, and empty seats count === 1, then mark that previous seat as 'should be reserved'
        // If we find an empty space, and 'should be reserved' is set, then move the last selected seat to that space
        // If we find a reserved seat of space, then reset 'should be reserved'
        let adjustedSeats = [...selectedSeats]
        let didChange = false;

        for (const section of this.sections) {
            for (const row of section.rows) {
                let emptySeatStack: ReservedSeat[] = [];
                let selectedSeatStack: ReservedSeat[] = [];
                let leftSwapSeat: ReservedSeat|null = null; 
                let allowRightSwap = false; // Only allow to move seats to the right if the left seat is adjacent to a empty seat, not a reserved seat or hallway

                for (const seat of [...row.seats, SeatingPlanSeat.create({ label: "", type: SeatType.Space })]) {
                    const rSeat = ReservedSeat.create({
                        section: section.id,
                        row: row.label,
                        seat: seat.label
                    })

                    if (selectedSeats.find(s => s.equals(rSeat))) {
                        if (emptySeatStack.length >= 1) {
                            allowRightSwap = true
                        }
                        if (emptySeatStack.length === 1) {
                            // We have a 'should be reserved'
                            leftSwapSeat = emptySeatStack[0]
                        }
                        emptySeatStack = []
                        selectedSeatStack.push(rSeat)
                    } else if (!seat.isValidSeat || (reservedSeats.find(s => s.equals(rSeat)) && !allowedSeats.find(s => s.equals(rSeat))) || (!asAdmin && this.isAdminSeat(rSeat))) {
                        if (allowRightSwap && emptySeatStack.length === 1 && selectedSeatStack.length) {
                            const from = selectedSeatStack[0]
                            const to = emptySeatStack[0]

                            // Move the first selected seat to the empty seat
                            adjustedSeats = adjustedSeats.map(s => {
                                if (s.equals(from)) {
                                    return to
                                }
                                return s
                            });
                            didChange = true;
                        }

                        // Space or reserved
                        emptySeatStack = []
                        selectedSeatStack = []
                        leftSwapSeat = null; // When we reach a selected seat that is next to a reserved seat, we don't want to swap it any longer
                        allowRightSwap = false
                    } else {
                        if (leftSwapSeat && selectedSeatStack.length) {
                            const from = selectedSeatStack[selectedSeatStack.length - 1]
                            const to = leftSwapSeat

                            // Move the last selected seat to the empty seat
                            adjustedSeats = adjustedSeats.map(s => {
                                if (s.equals(from)) {
                                    return to
                                }
                                return s
                            });
                            didChange = true;

                            leftSwapSeat = null
                            emptySeatStack = []
                            selectedSeatStack = []
                        }


                        emptySeatStack.push(rSeat)
                    }
                }
            }
        }

        if (!didChange) {
            return null;
        }

        return adjustedSeats;

    }
}

function isNumeric(str: string) {
    return /^\d+$/.test(str);
}

export class ReservedSeat extends AutoEncoder {
    /**
     * Id of the section
     */
    @field({ decoder: StringDecoder, field: 'se' })
    section = ""

    /**
     * label of the row
     */
    @field({ decoder: StringDecoder, field: 'r' })
    row = ""

    /**
     * label of the seat
     */
    @field({ decoder: StringDecoder, field: 's' })
    seat = ""

    getName(webshop: Webshop|WebshopPreview, product: Product): {title: string, value: string}[] {
        if (!product.seatingPlanId) {
            return []
        }
        const seatingPlan = webshop.meta.seatingPlans.find(p => p.id === product.seatingPlanId)
        if (!seatingPlan) {
            return []
        }

        const section = seatingPlan.sections.find(s => s.id === this.section)

        if (seatingPlan.sections.length === 1 || !section) {
            // Don't mention the section
            return [
                {
                    title: 'Rij',
                    value: this.row
                },
                {
                    title: 'Zetel',
                    value: this.seat
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
                value: this.row
            },
            {
                title: 'Zetel',
                value: this.seat
            }
        ];
    }

    getNameString(webshop: Webshop|WebshopPreview, product: Product) {
        if (!product.seatingPlanId) {
            return []
        }
        const seatingPlan = webshop.meta.seatingPlans.find(p => p.id === product.seatingPlanId)
        if (!seatingPlan) {
            return []
        }

        const section = seatingPlan.sections.find(s => s.id === this.section)

        if (seatingPlan.sections.length === 1 || !section) {
            if (isNumeric(this.row) !== isNumeric(this.seat)) {
                // Clean string
                return this.row + this.seat
            }

            return this.getName(webshop, product).map(p => p.title+': '+p.value).join(', ')
        }

        if (isNumeric(this.row) !== isNumeric(this.seat)) {
            // Clean string
            return section.name + ' ' + this.row + this.seat
        }

        return this.getName(webshop, product).map(p => p.title+': '+p.value).join(', ')
    }

    equals(reservedSeat: ReservedSeat) {
        return this.section === reservedSeat.section && this.row === reservedSeat.row && this.seat === reservedSeat.seat
    }
}

export class CartReservedSeat extends ReservedSeat {
    /**
     * Additional price that was applied
     */
    @field({ decoder: IntegerDecoder, field: 'p', optional: true })
    price = 0

    calculatePrice(seatingPlan: SeatingPlan) {
        const seat = seatingPlan.getSeat(this)
        if (!seat) {
            this.price = 0
            return this.price
        }
        const category = seatingPlan.categories.find(c => c.id === seat.category)
        if (!category) {
            this.price = 0
            return this.price
        }
        this.price = category.price
        return this.price
    }
}
