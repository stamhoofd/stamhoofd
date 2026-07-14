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
                                    hasHighlights: validHighlightSeats.length > 0 && !setSeats,
                                    occupied: isOccupied(row, seat) && !isSelected(row, seat) && !isHighlighted(row, seat),
                                }"
                                :style="{
                                    '--w': seat.width + 'px',
                                    '--h': seat.height + 'px',
                                    '--x': seat.x + 'px',
                                    '--y': seat.y + 'px',
                                    '--color': getSeatColor(seat),
                                }"
                                data-testid="seat-button"
                                @click="onClick(row, seat)"
                                @mouseover="onHover(row, seat)"
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

<script lang="ts" setup>
import { useIsMobile } from '#hooks/useIsMobile.ts';
import type { SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection } from '@stamhoofd/structures';
import { CartReservedSeat, ReservedSeat, SeatingSizeConfiguration, SeatMarkings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref, watchEffect } from 'vue';

import { Toast } from '../overlays/Toast';

const props = withDefaults(defineProps<{
    admin?: boolean;
    sizeConfig?: SeatingSizeConfiguration | null;
    seatingPlan: SeatingPlan;
    seatingPlanSection: SeatingPlanSection;
    amount?: number | null;
    seats?: ReservedSeat[];
    /**
     * Seats that are not available for selection anymore
     */
    reservedSeats?: ReservedSeat[];
    highlightSeats?: (ReservedSeat | null)[];
    setSeats?: (seats: ReservedSeat[]) => void;
    onClickSeat?: (seat: ReservedSeat) => void;
    onHoverSeat?: (seat: ReservedSeat) => void;
}>(), {
    admin: false,
    sizeConfig: null,
    amount: null,
    seats: () => [],
    reservedSeats: () => [],
    highlightSeats: () => [],
    setSeats: undefined,
    onClickSeat: undefined,
    onHoverSeat: undefined,
});

const isMobile = useIsMobile();
const selectedSeats = ref<HTMLButtonElement[]>([]);
let lastPriceToast: Toast | null = null;
const validHighlightSeats = computed(() => props.highlightSeats.filter((seat): seat is ReservedSeat => seat !== null));

const defaultSizeConfig = computed(() => {
    let config = new SeatingSizeConfiguration({
        seatWidth: 28,
        seatHeight: 28,
        seatXSpacing: 3,
        seatYSpacing: 8,
    });

    if (!props.setSeats && isMobile) {
        config = new SeatingSizeConfiguration({
            seatWidth: 20,
            seatHeight: 20,
            seatXSpacing: 2,
            seatYSpacing: 8,
        });
    } else if (isMobile) {
        config = new SeatingSizeConfiguration({
            seatWidth: 30,
            seatHeight: 30,
            seatXSpacing: 3,
            seatYSpacing: 8,
        });
    }

    props.seatingPlanSection.correctSizeConfig(config);
    return config;
});

const sizeConfig = computed(() => props.sizeConfig ?? defaultSizeConfig.value);
const rows = computed(() => props.seatingPlanSection.rows);
const size = computed(() => props.seatingPlanSection.calculateSize(sizeConfig.value));

/**
 * The drawing positions are cached on the rows and seats themselves, and those are replaced with
 * freshly decoded ones (with empty positions) every time the webshop is updated in place - e.g. when
 * it is reloaded in the background while this view is open. Recalculate the positions whenever the
 * rows or seats change, instead of only when the section itself is replaced.
 */
watchEffect(() => {
    props.seatingPlanSection.updatePositions(sizeConfig.value);
});

if (props.amount && props.setSeats) {
    const updatedSeats = props.seats.filter(seat => props.seatingPlan.isValidSeat(seat, props.reservedSeats));
    props.setSeats(updatedSeats.length > props.amount ? updatedSeats.slice(0, props.amount) : updatedSeats);
}

onMounted(() => {
    setTimeout(() => {
        const selectedSeat = selectedSeats.value[0];
        if (!selectedSeat) {
            return;
        }
        const bounds = selectedSeat.getBoundingClientRect();
        const scrollHeight = selectedSeat.closest('main')?.clientHeight;
        if (scrollHeight && bounds.top + bounds.height > scrollHeight - 30) {
            selectedSeat.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
            });
            document.documentElement.scrollTop = 0;
        }
    }, 400);
});

function toReservedSeat(row: SeatingPlanRow, seat: SeatingPlanSeat) {
    return ReservedSeat.create({
        section: props.seatingPlanSection.id,
        row: row.label,
        seat: seat.label,
    });
}

function isDisabledPersonSeat(seat: SeatingPlanSeat) {
    return seat.markings.includes(SeatMarkings.DisabledPerson);
}

function isSelected(row: SeatingPlanRow, seat: SeatingPlanSeat) {
    const reservedSeat = toReservedSeat(row, seat);
    return props.seats.some(s => s.equals(reservedSeat));
}

function isHighlighted(row: SeatingPlanRow, seat: SeatingPlanSeat) {
    const reservedSeat = toReservedSeat(row, seat);
    return validHighlightSeats.value.some(s => s.equals(reservedSeat));
}

function isOccupied(row: SeatingPlanRow, seat: SeatingPlanSeat) {
    const category = props.seatingPlan.categories.find(c => c.id === seat.category);
    if (!props.admin && category?.adminOnly) {
        return true;
    }
    const reservedSeat = toReservedSeat(row, seat);
    return props.reservedSeats.some(s => s.equals(reservedSeat));
}

function getSeatColor(seat: SeatingPlanSeat) {
    return props.seatingPlan.getSeatColor(seat);
}

function onHover(row: SeatingPlanRow, seat: SeatingPlanSeat) {
    if (props.onHoverSeat) {
        props.onHoverSeat(toReservedSeat(row, seat));
    }
}

function onClick(row: SeatingPlanRow, seat: SeatingPlanSeat) {
    if (props.onClickSeat) {
        props.onClickSeat(toReservedSeat(row, seat));
        return;
    }
    if (!props.setSeats || seat.isSpace) {
        return;
    }

    lastPriceToast?.hide();
    lastPriceToast = null;

    if (isSelected(row, seat)) {
        props.setSeats(props.seats.filter(s => s.section !== props.seatingPlanSection.id || s.row !== row.label || s.seat !== seat.label));
        return;
    }

    if (isOccupied(row, seat)) {
        new Toast($t(`%12r`), 'error red').show();
        return;
    }

    const addedSeat = toReservedSeat(row, seat);
    let seats = [...props.seats, addedSeat];

    if (props.amount && seats.length > props.amount) {
        const currentPosition = { x: seat.x, y: seat.y };
        let furthestSeat: { seat: ReservedSeat; distance: number } | null = null;

        for (const selectedSeat of seats) {
            if (selectedSeat.equals(addedSeat) || selectedSeat.section !== props.seatingPlanSection.id) {
                continue;
            }
            const selectedRow = props.seatingPlanSection.rows.find(r => r.label === selectedSeat.row);
            const seatData = selectedRow?.seats.find(s => s.label === selectedSeat.seat);
            if (!seatData) {
                continue;
            }
            const distance = Math.hypot(currentPosition.x - seatData.x, currentPosition.y - seatData.y);
            if (!furthestSeat || distance > furthestSeat.distance) {
                furthestSeat = { seat: selectedSeat, distance };
            }
        }

        seats = furthestSeat ? seats.filter(s => !s.equals(furthestSeat.seat)) : seats.slice(1);
    }

    props.setSeats(seats);

    const cartReservedSeat = CartReservedSeat.create(addedSeat);
    cartReservedSeat.calculatePrice(props.seatingPlan);
    if (cartReservedSeat.price > 0) {
        lastPriceToast = new Toast($t(`%12s`) + ' ' + Formatter.price(cartReservedSeat.price), 'info');
        lastPriceToast.show();
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.seat-selection-box {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    position: relative;
    overflow-x: auto;

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
        @extend %style-description;

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
        @extend %style-interactive-small;
        line-height: var(--h);
        color: $color-dark;
        color: var(--color, $color-dark);
        text-align: center;

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
