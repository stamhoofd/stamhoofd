<template>
    <div>
        <div
            class="seat-selection-box"
            :class="{'can-select': !!setSeats || !!onClickSeat}"
            :style="{
                '--sw': size.width + 'px',
                '--sh': size.height + 'px',
            }"
        >
            <div class="padding-container">
                <div 
                    class="seating-plan-seats"
                >
                    <div 
                        v-for="row of rows" 
                        :key="row.uuid" 
                        class="seating-plan-row" 
                        :style="{
                            '--rw': row.width + 'px',
                            '--rh': row.height + 'px',
                            '--rx': row.x + 'px',
                            '--ry': row.y + 'px',
                        }"
                    >
                        <span class="row-label left">{{ row.label }}</span>
                        <span class="row-label right">{{ row.label }}</span>

                        <div>
                            <button 
                                v-for="seat of row.seats" 
                                :key="seat.uuid"
                                :ref="isSelected(row, seat) ? 'selectedSeats' : undefined" 
                                type="button" 
                                class="seat"
                                :class="{
                                    space: seat.isSpace,
                                    disabledPerson: isDisabledPersonSeat(seat),
                                    selected: isSelected(row, seat),
                                    highlighted: isHighlighted(row, seat) && !isSelected(row, seat),
                                    hasHighlights: highlightSeats.length > 0 && !setSeats,
                                    occupied: isOccupied(row, seat) && !isSelected(row, seat) && !isHighlighted(row, seat),
                                }"
                                :style="{
                                    '--w': seat.width + 'px',
                                    '--h': seat.height + 'px',
                                    '--x': seat.x + 'px',
                                    '--y': seat.y + 'px',
                                    '--color': getSeatColor(seat),
                                }"
                                @click="onClick(row, seat)"
                            >
                                <span class="nr">{{ seat.label }}</span>
                                <span v-if="isDisabledPersonSeat(seat)" class="icon disabled-person" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CartReservedSeat, ReservedSeat, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatingSizeConfiguration, SeatMarkings } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import { Toast } from "../overlays/Toast";


@Component({
    components: {
        
    },
})
export default class SeatSelectionBox extends Mixins(NavigationMixin) {
    @Prop({ default: false })
        admin: boolean
        
    @Prop({ required: false, default: null})
        sizeConfig: SeatingSizeConfiguration|null

    @Prop({ required: true })
        seatingPlan!: SeatingPlan

    @Prop({ required: true })
        seatingPlanSection!: SeatingPlanSection

    @Prop({ required: false, default: null })
        amount: number|null

    @Prop({ required: false, default: () => []  })
        seats!: ReservedSeat[]

    /**
     * Seats that are not available for selection anymore
     */
    @Prop({ required: false, default: () => [] })
        reservedSeats!: ReservedSeat[]

    @Prop({ required: false, default: () => [] })
        highlightSeats!: ReservedSeat[]

    @Prop({ required: false })
        setSeats?: (seats: ReservedSeat[]) => void

    @Prop({ required: false })
        onClickSeat?: (seat: ReservedSeat) => void

    lastPriceToast: Toast|null = null

    created() {
        this.seatingPlanSection.updatePositions(this.sizeConfig ?? this.defaultSizeConfig)

        // Default selection
        if (this.amount && this.setSeats) {
            // if (this.seats.length < this.amount) {
            //     let seats: ReservedSeat[] = []
            //     const plan = this.seatingPlan
            //     for (const section of plan.sections) {
            //         for (const row of section.rows) {
            //             for (const seat of row.seats) {
            //                 if (seats.length >= this.amount) {
            //                     break
            //                 }
            // 
            //                 if (seat.isSpace) {
            //                     continue
            //                 }
            // 
            //                 const s = ReservedSeat.create({
            //                     section: section.id,
            //                     row: row.label,
            //                     seat: seat.label
            //                 })
            // 
            //                 if (this.reservedSeats.find(r => r.equals(s))) {
            //                     continue
            //                 }
            // 
            //                 seats.push(
            //                     s
            //                 )
            //             }
            //         }
            //     }
            //     this.setSeats?.(seats)
            // }
            let updatedSeats = this.seats.slice()

            // Remove invalid seats
            updatedSeats = updatedSeats.filter(seat => {
                return this.seatingPlan.isValidSeat(seat, this.reservedSeats)
            })

            if (updatedSeats.length > this.amount) {
                this.setSeats(updatedSeats.slice(0, this.amount))
            } else {
                this.setSeats(updatedSeats)
            }
        }
    }

    mounted() {
        setTimeout(() => {
            if (this.$refs.selectedSeats) {
                const selectedSeats = this.$refs.selectedSeats as HTMLElement[]
                if (selectedSeats.length > 0) {
                    selectedSeats[0].scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center"
                    })
                    // iOS fix:
                    document.documentElement.scrollTop = 0;
                }
            }
        }, 300);
    }

    @Watch('seatingPlanSection')
    onPlanChange() {
        this.seatingPlanSection.updatePositions(this.sizeConfig ?? this.defaultSizeConfig)
    }

    get rows() {
        return this.seatingPlanSection.rows
    }

    get defaultSizeConfig() {
        if (!this.setSeats && (this as any).$isMobile) {
            return new SeatingSizeConfiguration({
                seatWidth: 20,
                seatHeight: 20,
                seatXSpacing: 2,
                seatYSpacing: 8
            })
        }

        if ((this as any).$isMobile) {
            return new SeatingSizeConfiguration({
                seatWidth: 30,
                seatHeight: 30,
                seatXSpacing: 3,
                seatYSpacing: 8
            })
        }
        return new SeatingSizeConfiguration({
            seatWidth: 28,
            seatHeight: 28,
            seatXSpacing: 3,
            seatYSpacing: 8
        })
    }

    get size() {
        return this.seatingPlanSection.calculateSize(this.sizeConfig ?? this.defaultSizeConfig)
    }

    isDisabledPersonSeat(seat: SeatingPlanSeat) {
        return seat.markings.includes(SeatMarkings.DisabledPerson)
    }  

    isSelected(row: SeatingPlanRow, seat: SeatingPlanSeat) {
        const s = ReservedSeat.create({
            section: this.seatingPlanSection.id,
            row: row.label,
            seat: seat.label
        })
        
        for (const reservedSeat of this.seats) {
            if (reservedSeat.equals(s)) {
                return true
            }
        }
        return false;
    }

    isHighlighted(row: SeatingPlanRow, seat: SeatingPlanSeat) {
        const s = ReservedSeat.create({
            section: this.seatingPlanSection.id,
            row: row.label,
            seat: seat.label
        })
        return !!this.highlightSeats.find(r => r.equals(s))
    }

    isOccupied(row: SeatingPlanRow, seat: SeatingPlanSeat) {
        const category = this.seatingPlan.categories.find(c => c.id === seat.category)
        if (!this.admin && category && category.adminOnly) {
            return true;
        }

        const s = ReservedSeat.create({
            section: this.seatingPlanSection.id,
            row: row.label,
            seat: seat.label
        })
        return !!this.reservedSeats.find(r => r.equals(s))
    }

    getSeatColor(seat: SeatingPlanSeat) {
        return this.seatingPlan.getSeatColor(seat)
    }

    onClick(row: SeatingPlanRow, seat: SeatingPlanSeat) {
        if (this.onClickSeat) {
            this.onClickSeat(ReservedSeat.create({
                section: this.seatingPlanSection.id,
                row: row.label,
                seat: seat.label
            }))
            return
        }
        if (!this.setSeats) {
            return
        }

        if (seat.isSpace) {
            return
        }
        if (this.isOccupied(row, seat)) {
            new Toast('Deze plaats is al bezet', 'error red').show()
            return
        }

        if (this.lastPriceToast) {
            this.lastPriceToast.hide()
            this.lastPriceToast = null
        }

        // select/deselect this seat
        const selected = this.isSelected(row, seat)
        if (selected) {
            // deselect
            this.setSeats(
                this.seats.filter(s => s.section !== this.seatingPlanSection.id || s.row !== row.label || s.seat !== seat.label)
            )
        } else {
            // select
            const addedSeat = ReservedSeat.create({
                section: this.seatingPlanSection.id,
                row: row.label,
                seat: seat.label
            })

            let seats = [...this.seats, addedSeat]

            if (this.amount && seats.length > this.amount) {
                // Remove seat that is the furthest away
                let currentPosition = {x: seat.x, y: seat.y}

                let furthestSeat: {seat: ReservedSeat, distance: number} | null = null

                for (const s of seats) {
                    if (s.equals(addedSeat)) {
                        continue
                    }
                    if (s.section !== this.seatingPlanSection.id) {
                        continue
                    }

                    const row = this.seatingPlanSection.rows.find(r => r.label === s.row)
                    if (!row) {
                        continue
                    }

                    const seat = row.seats.find(ss => ss.label === s.seat)
                    if (!seat) {
                        continue
                    }

                    const distance = Math.sqrt(Math.pow(currentPosition.x - seat.x, 2) + Math.pow(currentPosition.y - seat.y, 2))
                    if (!furthestSeat || distance > furthestSeat.distance) {
                        furthestSeat = { seat: s, distance }
                    }
                }

                if (furthestSeat) {
                    seats = seats.filter(s => !s.equals(furthestSeat!.seat))
                } else {
                    // Remove first
                    seats = seats.slice(1)
                }
            }

            this.setSeats(seats)

            // Show a toast if price is higher
            const cartReservedSeat = CartReservedSeat.create(addedSeat)
            cartReservedSeat.calculatePrice(this.seatingPlan)

            if (cartReservedSeat.price > 0) {
                this.lastPriceToast = new Toast('Deze plaats heeft een meerprijs van ' + Formatter.price(cartReservedSeat.price), 'info')
                this.lastPriceToast.show()
            }
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.seat-selection-box {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    position: relative;
    overflow-x: scroll;
    
    // Fixes drawing issues
    transform: translate3d(0, 0, 0);

    .padding-container {
        // Padding should be here (otherwise won't be included in scollable area)
        padding: 15px calc(45px + var(--st-horizontal-padding));
        padding-bottom: 30px;
        width: var(--sw);
        margin: 0 auto;
        box-sizing: content-box;

        @media (max-width: 800px) {
            padding: 15px calc(25px + var(--st-horizontal-padding));
        }
    }

    .row-label {
        position: absolute;
        top: calc(var(--ry));
        height: var(--rh);
        line-height: var(--rh);
        font-size: 12px;
        @extend .style-description;

        &.left {
            left: -45px;

            @media (max-width: 800px) {
                left: -30px;
            }
        }

        &.right {
            right: -45px;
            text-align: right;

            @media (max-width: 800px) {
                right: -30px;
            }
        }
    }

    .seating-plan-seats {
        position: relative;
        width: var(--sw);
        height: var(--sh);
    }


    .seat {
        position: absolute;
        display: block;
        left: var(--x);
        top: var(--y);
        width: var(--w);
        height: var(--h);
        box-sizing: border-box;
        border-radius: 5px;
        @extend .style-interactive-small;
        line-height: var(--h);
        color: $color-dark;
        color: var(--color, $color-dark);

        &.disabledPerson > .nr {
            position: absolute;
            display: block;
            left: 0;
            top: 0;
            font-size: 10px;
            text-align: left;
            line-height: 15px;
            height: 15px;
            padding: 2px;
        }

        &::after {
            position: absolute;
            content: '';
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: -1;
            border-radius: 5px;

            border: $border-width solid $color-border;
            background: $color-background;
            box-shadow: 0px 1px 1px 0px rgba(0, 0, 0, 0.1);

            transition: background-color 0.2s, transform 0.2s;
            transform: scale(1, 1);
            animation-fill-mode: forwards;
        }

        .nr {
            opacity: 0.5;
        }
        &.space {
            font-size: 16px;
            color: $color-gray-text;
            font-weight: $font-weight-default;

            &::after {
                display: none;
            }

            .nr {
                opacity: 1;
            }

            &:first-child {
                text-align: left;
            }

            &:last-child {
                text-align: right;
            }

            &:first-child:last-child {
                text-align: center;
            }
        }

        &.highlighted {
            font-weight: bold;
            color: $color-background;

            &::after {
                background: $color-primary-gray-light;
                border-color: $color-primary-gray-light;
            }

            .nr {
                opacity: 1;
            }
        }

        &.selected {
            color: $color-primary-contrast; 
            font-weight: bold;

            &::after {
                background: $color-primary;
                animation: increase 0.2s;
                border-color: $color-primary;
                
                background: var(--color, $color-primary);
                border-color: var(--color, $color-primary);
            }

            .nr {
                opacity: 1;
            }

            &.hasHighlights {
                z-index: 1;

                &::after {
                    animation: 0.6s ease 0.4s bringToAttention;
                }
            }
        }

        &.occupied {
            .canSelect & {
                cursor: not-allowed;
            }

             .nr {
                opacity: 0.2;
            }


            &::after {
                background: $color-border;
            }

            
        }
    }

    &.can-select .seat {
        touch-action: manipulation;
        user-select: none;
        cursor: pointer;
    }

    .seat > .icon {
        position: absolute;
        left: calc((var(--w) - 18px) / 2 + 3px);
        top: calc((var(--h) - 18px) / 2 + 2px);
        z-index: 0;
        font-size: 18px;

        &:before {
            font-size: 18px;
        }
    }
}

@keyframes bringToAttention {
    0% {
        transform: scale(1, 1);
    }
    25% {
        transform: scale(1.8, 1.8);
        border-radius: 10px;
        background-color: $color-primary-dark;
    }
    50% {
        transform: scale(1, 1);
    }
    75% {
        transform: scale(2, 2);
        border-radius: 10px;
        background-color: $color-primary-dark;
    }
    100% {
        transform: scale(1, 1);
    }
}

@keyframes increase {
    0% {
        transform: scale(1, 1);
    }
    50% {
        transform: scale(1.3, 1.3);
        border-radius: 8px;
    }
    100% {
        transform: scale(1, 1);
    }
}

</style>
