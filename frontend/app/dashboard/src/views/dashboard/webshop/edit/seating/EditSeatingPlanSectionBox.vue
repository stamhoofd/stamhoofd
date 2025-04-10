<template>
    <div ref="root" class="edit-seating-plan-section-box" data-disable-enter-focus>
        <div class="undo-buttons">
            <button v-tooltip="'Spiegel verticaal'" type="button" class="button icon flip-vertical gray" @click="flip" />
            <button type="button" class="button icon undo gray" :disabled="!canUndo()" @click="undo" />
            <button type="button" class="button icon redo gray" :disabled="!canRedo()" @click="redo" />
        </div>
        <div class="seating-plan-section">
            <div class="padding-box">
                <p class="button-row">
                    <button class="button text" type="button" @click="addRow($event, false)">
                        <span class="icon add" />
                        <span>{{ $t('Rij') }}</span>
                    </button>

                    <button class="button text" type="button" @click="addRow($event, true)">
                        <span class="icon add" />
                        <span>{{ $t('Gang') }}</span>
                    </button>
                </p>

                <div
                    class="seating-plan-seats" :style="{
                        '--sw': size.width + 'px',
                        '--sh': size.height + 'px',
                    }"
                >
                    <div
                        v-for="row of rows" :key="row.uuid" :ref="'row-' + row.uuid" class="seating-plan-row" :style="{
                            '--rw': row.width + 'px',
                            '--rh': row.height + 'px',
                            '--rx': row.x + 'px',
                            '--ry': row.y + 'px',
                        }"
                    >
                        <input v-model="row.label" class="row-label left" :class="{error: isRowInvalid(row)}" @click.prevent="selectInput" @input="emitChange()"><input v-model="row.label" class="row-label right" :class="{error: isRowInvalid(row)}" @click.prevent="selectInput" @input="emitChange()"><button v-if="isRowSelected(row) || row.seats.length === 0" class="left add-seat-button button icon add gray hover-show" type="button" @click.prevent="addLeftSeat(row)" />

                        <button v-if="isRowSelected(row) || row.seats.length === 0" class="right add-seat-button button icon add gray hover-show" type="button" @click.prevent="addRightSeat(row)" />

                        <div>
                            <div
                                v-for="seat of row.seats" :key="seat.uuid" v-long-press="(e: MouseEvent | TouchEvent) => openContextMenu(e, seat)" class="seat" :class="{error: isSeatInvalid(row, seat), space: seat.isSpace, disabledPerson: isDisabledPersonSeat(seat), selected: isSeatSelected(seat)}" :style="{
                                    '--w': seat.width + 'px',
                                    '--h': seat.height + 'px',
                                    '--x': seat.x + 'px',
                                    '--y': seat.y + 'px',
                                    '--color': getSeatColor(seat)
                                }" @click.left="selectSeat(seat, $event)" @pointerdown.left="preventIfNotSelected(seat, $event)" @contextmenu.prevent.stop="openContextMenu($event, seat)"
                            >
                                <input :ref="(el) => storeSeatEl(el as HTMLInputElement | null, seat.uuid)" :data-uuid="seat.uuid" data-seat="true" :value="seat.label" :class="{error: isSeatInvalid(row, seat), space: seat.isSpace, disabledPerson: isDisabledPersonSeat(seat), selected: isSeatSelected(seat)}" @input="setSeat(row, seat, ($event as any).target.value)" @keydown.enter.prevent.stop="insertSeat(row, seat, $event)"><span v-if="isDisabledPersonSeat(seat)" class="icon disabled-person" />
                            </div>
                        </div>
                    </div>
                </div>

                <p class="button-row">
                    <button class="button text" type="button" @click="addRowBottom($event, false)">
                        <span class="icon add" />
                        <span>{{ $t('Rij') }}</span>
                    </button>

                    <button class="button text" type="button" @click="addRowBottom($event, true)">
                        <span class="icon add" />
                        <span>{{ $t('Gang') }}</span>
                    </button>
                </p>
            </div>
        </div>
        <p v-if="!isMobile" class="style-description-small">
            {{ $t('Voeg rijen en gangen toe. Binnen een rij kan je verticale gangen maken door een stoel aan te klikken met je rechtermuisknop en een gang links of rechts in te voegen. Je kan ook een stoel selecteren en wijzigen in een gang. Je kan tekst in een gang plaatsen ter informatie, bijvoorbeeld om ingangen en het podium aan te geven. Je kan de breedte van een gang of stoel wijzigen met je rechtermuisknop. Hou') }} <template v-if="$isMac || $isIOS">
                {{ $t('Command(⌘)') }}
            </template><template v-else>
                {{ $t('Ctrl') }}
            </template> {{ $t('en/of Shift(⇧) ingedrukt om meerdere stoelen te selecteren. Gebruik de Enter(⏎) toetst om snel stoelen toe te voegen. Gebruik Backspace(⌫) om een stoel of rij te verwijderen. Gebruik de pijltjestoetsen om snel te navigeren.') }}
        </p>
        <STErrorsDefault :error-box="errors.errorBox" />
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ContextMenu, ContextMenuItem, ErrorBox, STErrorsDefault, useErrors, useIsMobile, useValidation, Validator } from '@stamhoofd/components';
import { SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatingSizeConfiguration, SeatMarkings, SeatType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

const props = defineProps<{
    seatingPlan: SeatingPlan;
    seatingPlanSection: SeatingPlanSection;
    validator: Validator | null;
}>();

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<SeatingPlan>): void }>();
const isMobile = useIsMobile();
const root = ref<HTMLElement | null>(null);

const seatElementsMap = new Map<string, HTMLInputElement>();

const errors = useErrors({ validator: props.validator });
useValidation(errors.validator, () => {
    return validate();
});

function storeSeatEl(el: HTMLInputElement | null, uuid: string) {
    if (el === null) {
        seatElementsMap.delete(uuid);
    }
    else {
        seatElementsMap.set(uuid, el);
    }
}

const clonedSeatingPlanSection = ref(props.seatingPlanSection.clone());
const selectedSeats = ref<SeatingPlanSeat[]>([]);

const historyStack: SeatingPlanSection[] = [];
let redoHistoryStack: SeatingPlanSection[] = [];
let metaPressed = false;
let shiftPressed = false;
let hasFocus = false;

function getNextPattern(examples: string[]): string {
    if (examples.length === 0) {
        return '1';
    }
    if (examples.length === 1) {
        const v = examples[0];
        return incrementString(v);
    }

    if (examples.length === 2) {
        const v = examples[examples.length - 2];
        const v2 = examples[examples.length - 1];

        const difference = stringToNumber(v2) - stringToNumber(v);
        return incrementString(v2, difference);
    }

    // Detect pattern:
    // 17 19 20 -> 18
    // 17 19 18 -> 16
    const v = examples[examples.length - 3];
    const v2 = examples[examples.length - 2];
    const v3 = examples[examples.length - 1];
    const diff1 = stringToNumber(v2) - stringToNumber(v);
    const diff2 = stringToNumber(v3) - stringToNumber(v2);
    if (diff1 === diff2 * 2 || diff1 === -diff2 * 2) {
        // Return back
        return incrementString(v3, -diff1);
    }

    // Normal
    return incrementString(v3, diff2);
}

function stringToNumber(str: string) {
    // check is numeric
    if (parseInt(str) > 0) {
        return parseInt(str);
    }

    // check alphabetical
    // a = 1
    // b = 2
    // z = 26
    // aa = 27
    // ab = 28
    // az = 52
    // ba = 53
    const aCharCode = 'a'.charCodeAt(0);
    const zCharCode = 'z'.charCodeAt(0);

    // Convert into an array with min-max values aCharCode - zCharCode
    const chars = str.toLowerCase().split('').map(c => c.charCodeAt(0)).filter(c => c >= aCharCode && c <= zCharCode);

    // Calculate numeric value of this string
    let val = 0;
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i] - aCharCode + 1;
        const index = chars.length - i;
        val += char * Math.pow(26, index - 1);
    }
    return val;
}

function numberToAlpha(num: number) {
    // 1 = a
    // 2 = b
    // 26 = z
    // 27 = aa
    // 28 = ab
    // 52 = az
    // 53 = ba
    const aCharCode = 'a'.charCodeAt(0);

    // Convert into an array with min-max values aCharCode - zCharCode
    const chars: number[] = [];

    // Calculate numeric value of this string
    let val = num;
    while (val > 0) {
        const char = (val - 1) % 26;
        chars.unshift(char + aCharCode);
        val = Math.floor((val - 1) / 26);
    }

    return chars.map(c => String.fromCharCode(c)).join('');
}

function incrementString(string: string, value = 1) {
    // check is numeric
    if (parseInt(string) > 0) {
        const val = parseInt(string) + value;
        if (val <= 0) {
            return '';
        }
        return (val).toString();
    }

    if (string.length === 0) {
        return '';
    }

    const isAllCaps = string.toUpperCase() === string;

    const val = stringToNumber(string) + value;
    return isAllCaps ? numberToAlpha(val).toUpperCase() : numberToAlpha(val);
}

onActivated(() => {
    console.log('activated');

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onVisibilityChange);
});

onDeactivated(() => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onVisibilityChange);
});

onMounted(() => {
    clonedSeatingPlanSection.value.updatePositions(sizeConfig.value);

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onVisibilityChange);
});

onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('visibilitychange', onVisibilityChange);
});

function validate() {
    errors.errorBox = null;
    const se = new SimpleErrors();

    for (const [index, row] of rows.value.entries()) {
        if (isRowInvalid(row)) {
            se.addError(new SimpleError({
                code: 'invalid_row',
                message: `De ${index + 1}${index >= 1 ? 'de' : 'ste'} rij (van boven) is ongeldig. Kijk of de rij een letter/cijfer heeft gekregen en of die uniek is.`,
            }));
        }
        else {
            for (const [seatIndex, seat] of row.seats.entries()) {
                if (isSeatInvalid(row, seat)) {
                    se.addError(new SimpleError({
                        code: 'invalid_seat',
                        message: `De ${index + 1}${index >= 1 ? 'de' : 'ste'} rij (van boven) bevat een ongeldige zetel op plaats ${seatIndex + 1} vanaf links. Kijk of de zetel een letter/cijfer heeft gekregen en of die uniek is.`,
                    }));
                }
            }
        }
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(errors);
        return false;
    }

    return true;
}

const onDocumentClick = (event: MouseEvent) => {
    // If target went out of dom: ignore
    if (!document.body.contains(event.target as Node)) {
        return;
    }

    hasFocus = root.value?.contains(event.target as Node) ?? false;

    if (!hasFocus) {
        // Blur all
        selectedSeats.value = [];
        blurAll();
        return;
    }

    if (metaPressed) {
        // Click inside: ignore
        return;
    }

    let insideSelection = false;

    // Check target is or is inside a button element
    if (event.target && (event.target as HTMLElement).closest('button')) {
        return;
    }

    for (const seat of selectedSeats.value) {
        const seatElement = seatElementsMap.get(seat.uuid);

        // Check event is inside the selected row
        if (seatElement && event.target && seatElement.contains(event.target as Node)) {
            insideSelection = true;
        }
    }

    if (!insideSelection) {
        selectedSeats.value = [];
        blurAll();
    }
};

const onVisibilityChange = () => {
    metaPressed = false;
    shiftPressed = false;
};

const onKeyUp = (event: KeyboardEvent) => {
    // If lifting meta key
    if (event.key === 'Meta') {
        metaPressed = false;
    }
    if (event.key === 'Shift') {
        shiftPressed = false;
    }
};

const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Meta') {
        metaPressed = true;
    }
    if (event.key === 'Shift') {
        shiftPressed = true;
    }

    if ((event.key === 'z' || event.key === 'Z') && hasFocus) {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
            undo();
            event.preventDefault();
            return;
        }
        if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
            redo();
            event.preventDefault();
            return;
        }
    }
};

const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Meta') {
        metaPressed = true;
    }
    if (event.key === 'Shift') {
        shiftPressed = true;
    }

    if (!hasFocus) {
        return;
    }

    if (event.key === 'a' && metaPressed && hasFocus) {
        // Select all
        selectedSeats.value = rows.value.flatMap(r => r.seats);
        event.preventDefault();
        return;
    }

    if (event.key === 'Backspace' && selectedSeats.value.length) {
        // Delete the seats
        if (selectedSeats.value.length > 1) {
            const allowedEmptyRows = rows.value.filter(r => r.seats.length === 0);

            for (const seat of selectedSeats.value) {
                deleteSeat(seat);
            }

            // Delete all rows that have been emptied completely
            clonedSeatingPlanSection.value.rows = clonedSeatingPlanSection.value.rows.filter(r => r.seats.length > 0 && !allowedEmptyRows.includes(r));
            emitChange();

            // Prevent default: don't delete input text
            event.preventDefault();
        }
        else {
            // First delete contents, and only then the seat
            const seat = selectedSeats.value[0];
            backspaceSeat(seat, event);
        }
        return;
    }

    // Arrow down
    // if (event.key === "Enter" && this.selectedRows.length) {
    //     const seat = this.getSelectedSeat()
    //     if (seat) {
    //         // Default behaviour
    //         return;
    //     }
    //     const lastSelectedRow = this.selectedRows[this.selectedRows.length - 1]
    //
    //     // Insert new seat in row
    //     this.selectedRows = [lastSelectedRow]
    //     this.insertSeat(lastSelectedRow, null, event)
    //     return;
    // }

    // Arrow down
    if (event.key === 'ArrowDown' && selectedSeats.value.length) {
        event.preventDefault(); // prevent scroll

        let newSeats: SeatingPlanSeat[] = [];
        for (const seat of selectedSeats.value) {
            // More complex
            const newSeat = getSeatAt(seat.x + seat.width / 2, seat.y + seat.height + seat.height / 2);
            if (newSeat) {
                newSeats.push(newSeat);
            }
            else {
                // Not possible
                return;
            }
        }

        // Unique array
        newSeats = newSeats.filter((s, index) => newSeats.indexOf(s) === index);

        if (newSeats.length === selectedSeats.value.length) {
            if (newSeats.length === 1) {
                selectSingleSeat(newSeats[0]);
            }
            else {
                selectedSeats.value = newSeats;
                blurAll();
            }
        }
    }

    // Arrow up
    if (event.key === 'ArrowUp' && selectedSeats.value.length) {
        event.preventDefault(); // prevent scroll

        let newSeats: SeatingPlanSeat[] = [];
        for (const seat of selectedSeats.value) {
            // More complex
            const newSeat = getSeatAt(seat.x + seat.width / 2, seat.y - seat.height / 2);
            if (newSeat) {
                newSeats.push(newSeat);
            }
            else {
                // Not possible
                newSeats.push(seat);
            }
        }

        // Unique array
        newSeats = newSeats.filter((s, index) => newSeats.indexOf(s) === index);

        if (newSeats.length === selectedSeats.value.length) {
            if (newSeats.length === 1) {
                selectSingleSeat(newSeats[0]);
            }
            else {
                selectedSeats.value = newSeats;
                blurAll();
            }
        }
    }

    // Arrow left
    if (event.key === 'ArrowLeft' && selectedSeats.value.length) {
        event.preventDefault(); // prevent scroll

        let newSeats: SeatingPlanSeat[] = [];
        for (const seat of selectedSeats.value) {
            // Get seat left index
            const row = rows.value.find(r => r.seats.includes(seat));
            if (!row) {
                continue;
            }
            const index = row.seats.indexOf(seat);
            if (index > 0) {
                newSeats.push(row.seats[index - 1]);
            }
            else {
                // Not possible
                newSeats.push(seat);
            }
        }

        // Unique array
        newSeats = newSeats.filter((s, index) => newSeats.indexOf(s) === index);

        if (newSeats.length === selectedSeats.value.length) {
            if (newSeats.length === 1) {
                selectSingleSeat(newSeats[0]);
            }
            else {
                selectedSeats.value = newSeats;
                blurAll();
            }
        }
    }

    // Arrow right
    if (event.key === 'ArrowRight' && selectedSeats.value.length) {
        event.preventDefault(); // prevent scroll

        let newSeats: SeatingPlanSeat[] = [];
        for (const seat of selectedSeats.value) {
            // Get seat left index
            const row = rows.value.find(r => r.seats.includes(seat));
            if (!row) {
                continue;
            }
            const index = row.seats.indexOf(seat);
            if (index >= 0 && index < row.seats.length - 1) {
                newSeats.push(row.seats[index + 1]);
            }
            else {
                // Not possible
                newSeats.push(seat);
            }
        }

        // Unique array
        newSeats = newSeats.filter((s, index) => newSeats.indexOf(s) === index);

        if (newSeats.length === selectedSeats.value.length) {
            if (newSeats.length === 1) {
                selectSingleSeat(newSeats[0]);
            }
            else {
                selectedSeats.value = newSeats;
                blurAll();
            }
        }
    }
};

// function getSelectedSeat() {
//     const active = document.activeElement;
//     if (active && active.getAttribute('data-uuid')) {
//         const uuid = active.getAttribute('data-uuid');

//         for (const row of rows.value) {
//             for (const seat of row.seats) {
//                 if (seat.uuid === uuid) {
//                     return { seat, row };
//                 }
//             }
//         }
//     }

//     return null;
// }

function getSeatColor(seat: SeatingPlanSeat) {
    return props.seatingPlan.getSeatColor(seat);
}

function getSeatAt(x: number, y: number) {
    for (const row of rows.value) {
        if (row.y <= y && row.y + row.height >= y) {
            // It should be this row, no other
            for (const seat of row.seats) {
                if (seat.x + seat.width >= x) {
                    return seat;
                }
            }

            // Return last seat
            return row.seats[row.seats.length - 1] ?? null;
        }
    }
    return null;
}

function emitChange(options: { adjustHistory?: boolean } = {}) {
    // We use seatingPlanSection for the history stack because this one won't be changed already
    if (options.adjustHistory !== false) {
        historyStack.push(props.seatingPlanSection.clone());

        // clear redo stack
        redoHistoryStack = [];
    }

    clonedSeatingPlanSection.value.updatePositions(sizeConfig.value);

    const seatingPlanPatch = SeatingPlan.patch({ id: props.seatingPlan.id });
    seatingPlanPatch.sections.addPatch(SeatingPlanSection.patch({
        id: props.seatingPlanSection.id,
        rows: clonedSeatingPlanSection.value.rows.map(r => r.clone()) as any,
    }));
    emits('patch', seatingPlanPatch);
}

function canUndo() {
    return historyStack.length > 0;
}

function flip() {
    clonedSeatingPlanSection.value.rows.reverse();
    emitChange();
}

function undo() {
    if (!canUndo()) {
        return;
    }
    const last = historyStack.pop();
    if (last) {
        redoHistoryStack.push(clonedSeatingPlanSection.value.clone());
        clonedSeatingPlanSection.value = last;
        emitChange({ adjustHistory: false });
    }
}

function canRedo() {
    return redoHistoryStack.length > 0;
}

function redo() {
    if (!canRedo()) {
        return;
    }
    const last = redoHistoryStack.pop();
    if (last) {
        historyStack.push(clonedSeatingPlanSection.value.clone());
        clonedSeatingPlanSection.value = last;
        emitChange({ adjustHistory: false });
    }
}

const sizeConfig = computed(() => {
    let config = new SeatingSizeConfiguration({
        seatWidth: 28,
        seatHeight: 28,
        seatXSpacing: 3,
        seatYSpacing: 10,
    });
    if (isMobile) {
        config = new SeatingSizeConfiguration({
            seatWidth: 35,
            seatHeight: 35,
            seatXSpacing: 3 / 4 * 5,
            seatYSpacing: 10 / 4 * 5,
        });
    }

    clonedSeatingPlanSection.value.correctSizeConfig(config);
    return config;
});

const size = computed(() => clonedSeatingPlanSection.value.calculateSize(sizeConfig.value));

const rows = computed(() => clonedSeatingPlanSection.value.rows);

function addRow(_event: Event, isSpace: boolean) {
    const lastRows = clonedSeatingPlanSection.value.rows.filter(r => !!r.label).reverse();
    const lastIds = lastRows.map(r => r.label);
    const label = isSpace ? '' : getNextPattern(lastIds);

    const row = SeatingPlanRow.create({
        label,
        seats: isSpace ? [SeatingPlanSeat.create({ type: SeatType.Space, grow: 1 }), SeatingPlanSeat.create({ type: SeatType.Space, grow: 1 }), SeatingPlanSeat.create({ type: SeatType.Space, grow: 1 })] : (lastRows[lastRows.length - 1]?.seats ?? []).map(s => s.clone()),
    });
    clonedSeatingPlanSection.value.rows.unshift(row);
    emitChange();
}

function addRowBottom(_event: Event, isSpace: boolean) {
    const lastRows = clonedSeatingPlanSection.value.rows.filter(r => !!r.label);
    const lastIds = lastRows.map(r => r.label);
    const label = isSpace ? '' : getNextPattern(lastIds);

    const row = SeatingPlanRow.create({
        label,
        seats: isSpace ? [SeatingPlanSeat.create({ type: SeatType.Space, grow: 1 }), SeatingPlanSeat.create({ type: SeatType.Space, grow: 1 }), SeatingPlanSeat.create({ type: SeatType.Space, grow: 1 })] : (lastRows[lastRows.length - 1]?.seats ?? []).map(s => s.clone()),
    });
    clonedSeatingPlanSection.value.rows.push(row);
    emitChange();
}

function addRightSeat(row: SeatingPlanRow) {
    const lastIds = row.seats.map(s => s.label);
    const label = row.label.length === 0 ? '' : getNextPattern(lastIds);

    const seat = SeatingPlanSeat.create({
        label,
        category: props.seatingPlan.categories[0]?.id ?? null,
        type: row.label.length === 0 ? SeatType.Space : SeatType.Seat,
        grow: row.label.length === 0 ? 1 : 0,
    });
    row.seats.push(seat);
    emitChange();

    nextTick(() => {
        nextTick(() => {
            selectSingleSeat(seat);
        }).catch(console.error);
    }).catch(console.error);
}

function addLeftSeat(row: SeatingPlanRow) {
    const lastIds = row.seats.map(s => s.label).reverse();
    const label = row.label.length === 0 ? '' : getNextPattern(lastIds);

    const seat = SeatingPlanSeat.create({
        label,
        category: props.seatingPlan.categories[0]?.id ?? null,
        type: row.label.length === 0 ? SeatType.Space : SeatType.Seat,
        grow: row.label.length === 0 ? 1 : 0,
    });
    row.seats.unshift(seat);
    emitChange();

    nextTick(() => {
        nextTick(() => {
            selectSingleSeat(seat);
        }).catch(console.error);
    }).catch(console.error);
}

function isRowSelected(row: SeatingPlanRow) {
    return !!row.seats.find(s => selectedSeats.value.includes(s));
}

function isSeatSelected(seat: SeatingPlanSeat) {
    return selectedSeats.value.includes(seat);
}

function preventIfNotSelected(seat: SeatingPlanSeat, event: Event) {
    if (!selectedSeats.value.includes(seat)) {
        event.preventDefault();
    }
}

function selectSeat(seat: SeatingPlanSeat, event: Event) {
    let seats = [seat];
    if (shiftPressed) {
        if (selectedSeats.value.length === 0) {
            // Select first behaviour
        }
        else {
            const lastSelectedSeat = selectedSeats.value[selectedSeats.value.length - 1];
            const lastSelectedRowIndex = rows.value.findIndex(r => r.seats.includes(lastSelectedSeat));
            const currentRowIndex = rows.value.findIndex(r => r.seats.includes(seat));

            if (lastSelectedRowIndex === -1 || currentRowIndex === -1) {
                // Not possible
                return;
            }

            const lastSelectedRow = rows.value[lastSelectedRowIndex];
            const currentRow = rows.value[currentRowIndex];

            const lastIndex = lastSelectedRow.seats.indexOf(lastSelectedSeat);
            const currentIndex = currentRow.seats.indexOf(seat);

            const firstSeat = lastSelectedRowIndex === currentRowIndex ? (lastIndex < currentIndex ? lastSelectedSeat : seat) : (lastSelectedRowIndex < currentRowIndex ? lastSelectedSeat : seat);
            const lastSeat = firstSeat === lastSelectedSeat ? seat : lastSelectedSeat;

            const firstSeatRowIndex = rows.value.findIndex(r => r.seats.includes(firstSeat));
            const lastSeatRowIndex = rows.value.findIndex(r => r.seats.includes(lastSeat));

            const firstSeatRow = rows.value[firstSeatRowIndex];
            const lastSeatRow = rows.value[lastSeatRowIndex];

            const firstSeatIndex = firstSeatRow.seats.indexOf(firstSeat);
            const lastSeatIndex = lastSeatRow.seats.indexOf(lastSeat);

            // Start at the first seat (seat by seat and row by row), and loop all seats until the last seat
            let seatIndex = firstSeatIndex;
            let rowIndex = firstSeatRowIndex;

            while (rowIndex < lastSeatRowIndex || (rowIndex === lastSeatRowIndex && seatIndex <= lastSeatIndex)) {
                const row = rows.value[rowIndex];
                const seat = row.seats[seatIndex];
                seats.push(seat);

                if (seatIndex >= row.seats.length - 1) {
                    rowIndex++;
                    seatIndex = 0;
                }
                else {
                    seatIndex++;
                }
            }

            // Make sure we keep pervious lastSelectedSeat at the end of the array (consistent behaviour when choosing a different seat)
            seats = seats.filter(s => s !== lastSelectedSeat);
            if (!metaPressed) {
                seats.push(lastSelectedSeat);
            }
        }
    }

    if (metaPressed) {
        // Only select it without focus
        for (const oneSeat of seats) {
            if (selectedSeats.value.includes(oneSeat)) {
                // Only remove on click event (not focus)
                selectedSeats.value = selectedSeats.value.filter(s => s !== oneSeat);
            }
            else {
                selectedSeats.value.push(oneSeat);
            }
        }

        // Update focus of seat that was clicked on
        if (selectedSeats.value.includes(seat)) {
            selectInput(event);

            // Make sure we keep 'seat' at the end of the selectedSeats.value (for next shift action)
            selectedSeats.value = selectedSeats.value.filter(s => s !== seat);
            selectedSeats.value.push(seat);
        }
        else {
            blurInput(event);
        }

        return;
    }

    selectedSeats.value = seats;
    selectInput(event);
}

function selectInput(event: Event) {
    console.log('select input', event.currentTarget);
    const input = event.currentTarget as HTMLInputElement;
    // Check input is INPUT otherwise select child
    if (input.tagName !== 'INPUT') {
        const childInput = input.querySelector('input');
        if (childInput) {
            // Only select if not yet focused
            if (document.activeElement !== childInput) {
                childInput.select();
            }
        }
        return;
    }
    if (document.activeElement !== input) {
        input.select();
    }
}

function blurInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    // Check input is INPUT otherwise select child
    if (input.tagName !== 'INPUT') {
        const childInput = input.querySelector('input');
        if (childInput) {
            childInput.blur();
        }
        return;
    }
    input.blur();
}

function isRowInvalid(row: SeatingPlanRow) {
    if (!row.label) {
        // Should have no non-space seats
        return !!row.seats.find(s => !s.isSpace);
    }

    // Should not have a row with the same label
    const slug = Formatter.slug(row.label);
    return clonedSeatingPlanSection.value.rows.filter(r => Formatter.slug(r.label) === slug).length > 1; // Row is also included, so should be 1
}

function isSeatInvalid(row: SeatingPlanRow, seat: SeatingPlanSeat) {
    return !seat.isSpace && (Formatter.slug(seat.label).length === 0 || row.seats.filter(s => !s.isSpace && Formatter.slug(s.label) === Formatter.slug(seat.label)).length > 1);
}

function setSeat(_row: SeatingPlanRow, seat: SeatingPlanSeat, value: string) {
    seat.label = value;
    emitChange();

    // Select all other seats and rows
    // this.selectedRows = [row]
    selectedSeats.value = [seat];
}

function insertSeat(row: SeatingPlanRow, seat: SeatingPlanSeat | null, event: KeyboardEvent) {
    // Insert a seat in the row
    const index = seat === null ? (row.seats.length - 1) : row.seats.indexOf(seat);
    if (seat === null || index >= 0) {
        const previousIds = row.seats.slice(0, index + 1).map(s => s.label);
        const label = getNextPattern(previousIds);

        const newSeat = SeatingPlanSeat.create({
            label,
            category: seat?.category ?? props.seatingPlan.categories[0]?.id ?? null,
        });
        row.seats.splice(index + 1, 0, newSeat);
        emitChange();

        nextTick(() => {
            nextTick(() => {
                selectSingleSeat(newSeat);
            }).catch(console.error);
        }).catch(console.error);
    }

    // We handled the event, don't change the input
    event.preventDefault();
}

function selectSingleSeat(seat: SeatingPlanSeat) {
    const ref = seatElementsMap.get(seat.uuid);
    if (ref) {
        selectedSeats.value = [seat];
        ref.select();
    }
    else {
        console.warn('Could not find input ' + seat.uuid);
    }
}

function backspaceRow(row: SeatingPlanRow, event: Event) {
    // Delete the row
    const index = clonedSeatingPlanSection.value.rows.indexOf(row);
    if (index >= 0) {
        clonedSeatingPlanSection.value.rows.splice(index, 1);
        emitChange();
    }

    // We handled the event, don't change the input
    event.preventDefault();
}

function deleteSeat(seat: SeatingPlanSeat) {
    const row = clonedSeatingPlanSection.value.rows.find(r => r.seats.includes(seat));
    if (!row) {
        return;
    }
    // Delete the seat from the row
    const index = row.seats.indexOf(seat);
    if (index >= 0) {
        row.seats.splice(index, 1);
        emitChange();
    }
}

function backspaceSeat(seat: SeatingPlanSeat, event: KeyboardEvent) {
    if (seat.label.length > 0) {
        return;
    }
    const row = clonedSeatingPlanSection.value.rows.find(r => r.seats.includes(seat));
    if (!row) {
        return;
    }

    // Delete the seat from the row
    const index = row.seats.indexOf(seat);
    if (index >= 0) {
        row.seats.splice(index, 1);
        emitChange();

        // Focus the previous seat, or next seat (if it was first)
        const newSeat = row.seats[index - 1] ?? row.seats[index];
        if (newSeat) {
            selectSingleSeat(newSeat);
        }
    }

    // If total seats left is 0, delete the row
    if (row.seats.length === 0) {
        backspaceRow(row, event);
    }

    // We handled the event, don't change the input
    event.preventDefault();
}

function isDisabledPersonSeat(seat: SeatingPlanSeat) {
    return seat.markings.includes(SeatMarkings.DisabledPerson);
}

function blurAll() {
    const el = document.activeElement as HTMLElement;
    if (el && root.value?.contains(el) && el.hasAttribute('data-seat')) {
        el.blur();
    }
}

function getInsertMenu(row: SeatingPlanRow, seatIndex: number) {
    return new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Zetel',
                icon: 'seat',
                action: () => {
                    if (seatIndex >= 0) {
                        let previousIds = row.seats.slice(0, seatIndex).map(s => s.label);
                        if (previousIds.length === 0) {
                            // next ids, reversed
                            previousIds = row.seats.slice(seatIndex).map(s => s.label).reverse();
                        }
                        const label = getNextPattern(previousIds);
                        row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                            label,
                            category: props.seatingPlan.categories[0]?.id ?? null,
                        }));
                        emitChange();
                    }
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Gang',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: '1',
                            action: () => {
                                if (seatIndex >= 0) {
                                    row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                        type: SeatType.Space,
                                        category: props.seatingPlan.categories[0]?.id ?? null,
                                    }));
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                        new ContextMenuItem({
                            name: '2',
                            action: () => {
                                if (seatIndex >= 0) {
                                    row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                        blockWidth: 4,
                                        type: SeatType.Space,
                                        category: props.seatingPlan.categories[0]?.id ?? null,
                                    }));
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                        new ContextMenuItem({
                            name: '3',
                            action: () => {
                                if (seatIndex >= 0) {
                                    row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                        blockWidth: 6,
                                        type: SeatType.Space,
                                        category: props.seatingPlan.categories[0]?.id ?? null,
                                    }));
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                        new ContextMenuItem({
                            name: '4',
                            action: () => {
                                if (seatIndex >= 0) {
                                    row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                        blockWidth: 8,
                                        type: SeatType.Space,
                                        category: props.seatingPlan.categories[0]?.id ?? null,
                                    }));
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                        new ContextMenuItem({
                            name: 'Automatisch',
                            description: 'Neemt de volledige beschikbare ruimte in',
                            action: () => {
                                if (seatIndex >= 0) {
                                    row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                        grow: 1,
                                        type: SeatType.Space,
                                        category: props.seatingPlan.categories[0]?.id ?? null,
                                    }));
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                    ],
                ]),
            }),
        ],
    ]);
}

function openContextMenu(event: MouseEvent | TouchEvent, seat: SeatingPlanSeat) {
    if (isMobile) {
        blurAll();
    }

    // If seat is outside selection: select only this seat
    if (!selectedSeats.value.includes(seat)) {
        selectSeat(seat, event);
    }

    const selectedRows = clonedSeatingPlanSection.value.rows.filter(r => isRowSelected(r));
    const items: ContextMenuItem[][] = [];

    if (selectedRows.length === 1) {
        const row = selectedRows[0];

        // Single row menu
        items.push([
            new ContextMenuItem({
                name: 'Rij',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Dupliceren',
                            icon: 'copy',
                            action: () => {
                                const clonedRow = row.clone();

                                const previousIds = clonedSeatingPlanSection.value.rows.slice(clonedSeatingPlanSection.value.rows.indexOf(row)).map(r => r.label).reverse();
                                const label = getNextPattern(previousIds);
                                clonedRow.label = label;
                                const index = clonedSeatingPlanSection.value.rows.indexOf(row);
                                if (index >= 0) {
                                    clonedSeatingPlanSection.value.rows.splice(index, 0, clonedRow);
                                    emitChange();
                                }
                                return true;
                            },
                        }),

                        new ContextMenuItem({
                            name: 'Verplaats naar boven',
                            icon: 'arrow-up',
                            disabled: clonedSeatingPlanSection.value.rows.indexOf(row) <= 0,
                            action: () => {
                                const index = clonedSeatingPlanSection.value.rows.indexOf(row);
                                if (index >= 0 && index > 0) {
                                    clonedSeatingPlanSection.value.rows.splice(index - 1, 0, row);
                                    clonedSeatingPlanSection.value.rows.splice(index + 1, 1);
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                        new ContextMenuItem({
                            name: 'Verplaats naar beneden',
                            icon: 'arrow-down',
                            disabled: clonedSeatingPlanSection.value.rows.indexOf(row) >= clonedSeatingPlanSection.value.rows.length - 1,
                            action: () => {
                                const index = clonedSeatingPlanSection.value.rows.indexOf(row);
                                if (index >= 0 && index < clonedSeatingPlanSection.value.rows.length - 1) {
                                    clonedSeatingPlanSection.value.rows.splice(index + 2, 0, row);
                                    clonedSeatingPlanSection.value.rows.splice(index, 1);
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                        new ContextMenuItem({
                            name: 'Verwijderen',
                            icon: 'trash',
                            action: () => {
                                const index = clonedSeatingPlanSection.value.rows.indexOf(row);
                                if (index >= 0) {
                                    clonedSeatingPlanSection.value.rows.splice(index, 1);
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                    ],
                ]),
            }),
        ]);
    }

    // Single seat items
    if (selectedSeats.value.length === 1) {
        const seat = selectedSeats.value[0];
        const row = clonedSeatingPlanSection.value.rows.find(r => r.seats.includes(seat));
        if (!row) {
            return;
        }
        items.push([
            new ContextMenuItem({
                name: 'Zetel verplaatsen',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Links',
                            icon: 'arrow-left',
                            disabled: row.seats.indexOf(seat) <= 0,
                            action: () => {
                                const index = row.seats.indexOf(seat);
                                if (index > 0) {
                                    row.seats.splice(index, 1);
                                    row.seats.splice(index - 1, 0, seat);
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                        new ContextMenuItem({
                            name: 'Rechts',
                            icon: 'arrow-right',
                            disabled: row.seats.indexOf(seat) >= row.seats.length - 1,
                            action: () => {
                                const index = row.seats.indexOf(seat);
                                if (index >= 0 && index < row.seats.length - 1) {
                                    row.seats.splice(index, 1);
                                    row.seats.splice(index + 1, 0, seat);
                                    emitChange();
                                }
                                return true;
                            },
                        }),
                    ],
                ]),
            }),
            new ContextMenuItem({
                name: 'Invoegen',
                icon: 'add',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Links',
                            childMenu: getInsertMenu(row, row.seats.indexOf(seat)),
                        }),
                        new ContextMenuItem({
                            name: 'Rechts',
                            childMenu: getInsertMenu(row, row.seats.indexOf(seat) + 1),
                        }),
                    ],
                ]),
            }),
        ]);
    }

    // Multi seat items
    items.push([
        new ContextMenuItem({
            name: 'Breedte',
            childMenu: new ContextMenu([
                [
                    new ContextMenuItem({
                        name: '1',
                        action: () => {
                            for (const seat of selectedSeats.value) {
                                seat.blockWidth = 2;
                                seat.grow = 0;
                            }
                            emitChange();
                            return true;
                        },
                    }),
                    new ContextMenuItem({
                        name: '2',
                        action: () => {
                            for (const seat of selectedSeats.value) {
                                seat.blockWidth = 2 * 2;
                                seat.grow = 0;
                            }
                            emitChange();
                            return true;
                        },
                    }),
                    new ContextMenuItem({
                        name: '3',
                        action: () => {
                            for (const seat of selectedSeats.value) {
                                seat.blockWidth = 2 * 3;
                                seat.grow = 0;
                            }
                            emitChange();
                            return true;
                        },
                    }),
                    new ContextMenuItem({
                        name: '4',
                        action: () => {
                            for (const seat of selectedSeats.value) {
                                seat.blockWidth = 2 * 4;
                                seat.grow = 0;
                            }
                            emitChange();
                            return true;
                        },
                    }),
                ],
                [
                    new ContextMenuItem({
                        name: 'Automatisch',
                        description: 'Groei automatisch om de volledige rij te vullen',
                        action: () => {
                            for (const seat of selectedSeats.value) {
                                seat.blockWidth = 2;
                                seat.grow = 1;
                            }
                            emitChange();
                            return true;
                        },
                    }),
                ],
            ]),
        }),
        new ContextMenuItem({
            name: 'Type',
            childMenu: new ContextMenu([
                [
                    new ContextMenuItem({
                        name: 'Zetel',
                        selected: !!selectedSeats.value.find(seat => seat.type === SeatType.Seat),
                        action: () => {
                            for (const seat of selectedSeats.value) {
                                seat.type = SeatType.Seat;
                            }
                            emitChange();
                            return true;
                        },
                    }),
                    new ContextMenuItem({
                        name: 'Gang',
                        selected: !!selectedSeats.value.find(seat => seat.type === SeatType.Space),
                        action: () => {
                            for (const seat of selectedSeats.value) {
                                seat.type = SeatType.Space;
                            }
                            emitChange();
                            return true;
                        },
                    }),
                ],
            ]),
        }),
        new ContextMenuItem({
            name: 'Markeringen',
            childMenu: new ContextMenu([
                [
                    new ContextMenuItem({
                        name: 'Mindervalide plaats',
                        icon: 'disabled-person',
                        selected: !!selectedSeats.value.find(seat => seat.markings.includes(SeatMarkings.DisabledPerson)),
                        action: () => {
                            const selected = !!selectedSeats.value.find(seat => seat.markings.includes(SeatMarkings.DisabledPerson));

                            for (const seat of selectedSeats.value) {
                                if (!seat.markings.includes(SeatMarkings.DisabledPerson)) {
                                    if (!selected) {
                                        seat.markings.push(SeatMarkings.DisabledPerson);
                                    }
                                }
                                else {
                                    if (selected) {
                                        seat.markings = seat.markings.filter(m => m !== SeatMarkings.DisabledPerson);
                                    }
                                }
                            }
                            emitChange();
                            return true;
                        },
                    }),
                ],
            ]),
        }),
        ...((props.seatingPlan.categories.length > 1)
            ? [new ContextMenuItem({
                    name: 'Categorie',
                    childMenu: new ContextMenu([
                        props.seatingPlan.categories.map((category) => {
                            let allMatching = true;
                            let oneMatching = false;

                            for (const seat of selectedSeats.value) {
                                if (seat.category !== category.id) {
                                    allMatching = false;
                                }
                                else {
                                    oneMatching = true;
                                }
                            }

                            return new ContextMenuItem({
                                name: category.name,
                                selected: allMatching || oneMatching,
                                action: () => {
                                    for (const seat of selectedSeats.value) {
                                        seat.category = category.id;
                                    }
                                    emitChange();
                                    return true;
                                },
                            });
                        }),
                    ]),
                })]
            : []),
        new ContextMenuItem({
            name: 'Zetel verwijderen',
            icon: 'trash',
            action: () => {
                for (const seat of selectedSeats.value) {
                    const rowIndex = clonedSeatingPlanSection.value.rows.findIndex(r => r.seats.includes(seat));
                    if (rowIndex === -1) {
                        continue;
                    }
                    const row = clonedSeatingPlanSection.value.rows[rowIndex];
                    const index = row.seats.indexOf(seat);
                    if (index >= 0) {
                        row.seats.splice(index, 1);
                    }
                    // Became empty?
                    if (row.seats.length === 0) {
                        clonedSeatingPlanSection.value.rows.splice(rowIndex, 1);
                    }
                }
                emitChange();
                return true;
            },
        }),
    ]);

    const contextMenu = new ContextMenu([
        ...items,
    ]);
    contextMenu.show({
        clickEvent: event,
    }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.edit-seating-plan-section-box {
    .undo-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 15px;
    }
}

.seating-plan-section {
    background: $color-background-shade;
    box-shadow: inset 0px 0px 200px rgba(0, 0, 0, 0.15), inset 0px 2px 10px rgba(0, 0, 0, 0.1);
    border-radius: $border-radius;
    overflow-x: auto;
    margin-bottom: 10px;
    transform: translate3d(0,0,0); // fixes drawing rounding issues, and makes sure the seating section is drawn on its own before rendering in the page

    .padding-box {
        padding: 20px 90px;
    }

    .seating-plan-seats {
        position: relative;
        width: var(--sw);
        height: var(--sh);
        margin: 20px auto;
        contain: layout size;
        will-change: width, height;
    }

    .row-label {
        position: absolute;
        top: var(--ry);
        width: 40px;
        height: var(--rh);
        line-height: var(--rh);

        text-align: right;
        box-sizing: border-box;
        @extend .style-description;
        contain: layout size;
        border-bottom: 2px solid transparent;

        &:focus {
            border-color: $color-primary;
        }

        &.left {
            left: -80px;
            padding-right: 10px;
        }

        &.right {
            right: -80px;
            text-align: left;
            padding-left: 10px;
        }

        &.error {
            border: $color-error-border;
            box-shadow: 0 0 0 1px $color-error-border;
            color: $color-error;
        }
    }

    .add-seat-button {
        position: absolute;
        top: calc(var(--ry) + var(--rh) / 2 - 12px);
        width: 24px;
        height: 24px;
        contain: layout size;
        z-index: 1;
        color: $color-primary;

        &.left {
            left: -29px;
        }

        &.right {
            right: -29px;
        }
    }

    .row-background {
        position: absolute;
        height: calc(var(--rh) + 6px);
        top: calc(var(--ry) - 3px);
        left: 0;
        right: 0;
        contain: layout size;
        border-radius: 5px;
        z-index: 2;
        box-sizing: border-box;
        cursor: pointer;
        border: 2px solid transparent;

        &:hover {
            border-color: $color-primary-gray-light;
        }

        &.clickThrough {
            z-index: 0;
        }

        &.selected {
            cursor: inherit;
            border-color: $color-primary;
            background: $color-primary-background;
        }
    }

    .seating-plan-row:focus-within .row-background.selected {
        border-color: transparent;
        background: transparent;
    }

    .seat {
        position: absolute;
        display: block;
        z-index: 1;
        left: var(--x);
        top: var(--y);
        width: var(--w);
        height: var(--h);
        box-sizing: border-box;
        @extend .style-input-box;
        background: white;
        border-radius: 5px;
        contain: strict;
        will-change: transform, width, height;
        touch-action: manipulation;

        &.selected {
            border-color: $color-primary;
            box-shadow: 0 0 0 1px $color-primary;
        }

        &.error {
            border-color: $color-error-border;
            box-shadow: 0 0 0 1px $color-error-border;

            &:focus,
            &:focus-within {
                border-color: $color-error-border-focus;
                box-shadow: 0 0 0 1px $color-error-border-focus;
            }
        }

        &.space {
            border: $border-width dashed $color-border;
            box-shadow: none;
            background: transparent;

            &:focus, &:focus-within, &.selected {
                border: $border-width solid $color-primary;
                box-shadow: 0 0 0 1px $color-primary;
            }

            &:first-child input {
                text-align: left;
            }

            &:last-child input {
                text-align: right;
            }

            &:first-child:last-child input {
                text-align: center;
            }
        }
    }

    .seat > input {
        position: absolute;
        width: calc(var(--w) - 2px);
        height: calc(var(--h) - 2px);
        left: 0;
        top: 0;
        @extend .style-input;
        text-align: center;
        line-height: calc(var(--h) - 2px);
        box-sizing: border-box;
        contain: layout size;
        z-index: 1;
        color: var(--color);

        &.disabledPerson:not(:focus) {
            font-size: 10px;
            text-align: left;
            line-height: 15px;
            height: 15px;
            padding: 2px;
        }

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

    .seat > input:focus + .icon {
        display: none;
    }

    .seats > button {

        &:first-child {
            margin-right: auto;
        }

        &:last-child {
            margin-left: auto;
        }
    }

    .button-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
    }
}

</style>
