<template>
    <div class="edit-seating-plan-section-box" data-disable-enter-focus>
        <div class="undo-buttons">
            <button type="button" class="button icon undo gray" :disabled="!canUndo()" @click="undo" />
            <button type="button" class="button icon redo gray" :disabled="!canRedo()" @click="redo" />
        </div>
        <div class="seating-plan-section">
            <div class="padding-box">
                <p class="button-row">
                    <button class="button text" type="button" @click="addRow">
                        <span class="icon add" />
                        <span>Rij</span>
                    </button>
                </p>

                <div 
                    class="seating-plan-seats"
                    :style="{
                        '--sw': size.width + 'px',
                        '--sh': size.height + 'px',
                    }"
                >
                    <div 
                        v-for="row of rows" 
                        :key="row.uuid" 
                        :ref="'row-' + row.uuid"
                        class="seating-plan-row"
                        :style="{
                            '--rw': row.width + 'px',
                            '--rh': row.height + 'px',
                            '--rx': row.x + 'px',
                            '--ry': row.y + 'px',
                        }"
                    >
                        <div 
                            class="row-background" 
                            :class="{selected: isRowSelected(row)}" 
                            @click="selectRow($event, row)" 
                            @contextmenu.prevent="openContextMenu($event, row)"
                            @keydown.delete.stop="backspaceRow(row, $event)"
                        />
                        <input 
                            v-model="row.label" 
                            class="row-label left"
                            :class="{error: isRowInvalid(row)}"
                            @click.prevent="selectInput"
                            @input="emitChange()"
                        >
                        <input 
                            v-model="row.label" 
                            class="row-label right"
                            :class="{error: isRowInvalid(row)}"
                            @click.prevent="selectInput" 
                            @input="emitChange()"
                        >
                        <button 
                            v-if="isRowSelected(row)" 
                            class="left add-seat-button button icon add gray hover-show" 
                            type="button" 
                            @click="addLeftSeat(row)"
                        />

                        <button 
                            v-if="isRowSelected(row)" 
                            class="right add-seat-button button icon add gray hover-show" 
                            type="button" 
                            @click="addRightSeat(row)"
                        />

                        <div>
                            <div 
                                v-for="seat of row.seats" 
                                :key="seat.uuid" 
                                class="seat" 
                                :class="{error: isSeatInvalid(row, seat), space: seat.isSpace, disabledPerson: isDisabledPersonSeat(seat)}"
                                :style="{
                                    '--w': seat.width + 'px',
                                    '--h': seat.height + 'px',
                                    '--x': seat.x + 'px',
                                    '--y': seat.y + 'px',
                                    '--color': getSeatColor(seat)
                                }"
                                @click.prevent="selectInput" 
                                @contextmenu.prevent.stop="openContextMenu($event, row, seat)"
                            >
                                <input 
                                    :ref="'seat-input-' + seat.uuid" 
                                    :data-uuid="seat.uuid"
                                    :value="seat.label" 
                                    :class="{error: isSeatInvalid(row, seat), space: seat.isSpace, disabledPerson: isDisabledPersonSeat(seat)}" 
                                    @focus.prevent="selectInput"
                                    @input="setSeat(row, seat, $event.target.value)"
                                    @keydown.delete.stop="backspaceSeat(row, seat, $event)"
                                    @keydown.enter.prevent.stop="insertSeat(row, seat, $event)"
                                >
                                <span v-if="isDisabledPersonSeat(seat)" class="icon disabled-person" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <p class="style-description-small">
            Klik op een rij om een rij te selecteren. Vervolgens kan je op een stoel of gang klikken om het nummer of tekst in de gang te wijzigen. Je kan sneller werken door de ENTER en BACKSPACE toetsen te gebruiken, in combinatie met de pijltjes en de rechtermuisknop (dupliceren, invoegen, verplaatsen...). Als je tekst in je zaal wenst kan je een lege rij toevoegen met daarin één of meerdere gangen. Zo kan je bijvoorbeeld links en rechts andere tekst plaatsen door 3 gangzitjes toe te voegen in een lege rij en de breedte op automatisch te zetten van alle 3 de gangzitjes.
        </p>
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, ErrorBox, STErrorsDefault, Validator } from '@stamhoofd/components';
import { SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatingSizeConfiguration, SeatMarkings, SeatType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

function getNextPattern(examples: string[]): string {
    if (examples.length === 0) {
        return "1"
    }
    if (examples.length === 1) {
        const v = examples[0]
        return incrementString(v)
    }

    if (examples.length === 2) {
        const v = examples[examples.length - 2]
        const v2 = examples[examples.length - 1]
        
        const difference = stringToNumber(v2) - stringToNumber(v)
        return incrementString(v2, difference)
    }

    // Detect pattern:
    // 17 19 20 -> 18
    // 17 19 18 -> 16
    const v = examples[examples.length - 3]
    const v2 = examples[examples.length - 2]
    const v3 = examples[examples.length - 1]
    const diff1 = stringToNumber(v2) - stringToNumber(v)
    const diff2 = stringToNumber(v3) - stringToNumber(v2)
    if (diff1 === diff2 * 2 || diff1 === -diff2*2) {
        // Return back
        return incrementString(v3, -diff1)
    }

    // Normal
    return incrementString(v3, diff2)
}

function stringToNumber(str: string) {
    // check is numeric
    if (parseInt(str) > 0) {
        return parseInt(str)
    }

    // check alphabetical
    // a = 1
    // b = 2
    // z = 26
    // aa = 27
    // ab = 28
    // az = 52
    // ba = 53
    const aCharCode = 'a'.charCodeAt(0)
    const zCharCode = 'z'.charCodeAt(0)

    // Convert into an array with min-max values aCharCode - zCharCode
    const chars = str.toLowerCase().split("").map(c => c.charCodeAt(0)).filter(c => c >= aCharCode && c <= zCharCode)

    // Calculate numeric value of this string
    let val = 0;
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i] - aCharCode + 1
        const index = chars.length - i
        val += char * Math.pow(26, index - 1)
    }
    return val
}

function numberToAlpha(num: number) {
    // 1 = a
    // 2 = b
    // 26 = z
    // 27 = aa
    // 28 = ab
    // 52 = az
    // 53 = ba
    const aCharCode = 'a'.charCodeAt(0)

    // Convert into an array with min-max values aCharCode - zCharCode
    const chars: number[] = []

    // Calculate numeric value of this string
    let val = num;
    while (val > 0) {
        const char = (val - 1) % 26
        chars.unshift(char + aCharCode)
        val = Math.floor((val - 1)/ 26)
    }

    return chars.map(c => String.fromCharCode(c)).join("")
}

function incrementString(string: string, value = 1) {
    // check is numeric
    if (parseInt(string) > 0) {
        const val = parseInt(string) + value
        if (val <= 0) {
            return ''
        }
        return (val).toString()
    }

    if (string.length === 0) {
        return ""
    }

    const isAllCaps = string.toUpperCase() === string

    const val = stringToNumber(string) + value
    return isAllCaps ? numberToAlpha(val).toUpperCase() : numberToAlpha(val)
}


@Component({
    components: {
        STErrorsDefault
    },
})
export default class EditSeatingPlanSectionBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        seatingPlan!: SeatingPlan

    @Prop({ required: true })
        seatingPlanSection!: SeatingPlanSection

    @Prop({ default: null }) 
        validator: Validator | null

    errorBox: ErrorBox | null = null

    clonedSeatingPlanSection = this.seatingPlanSection.clone()

    selectedRow: SeatingPlanRow | null = null

    historyStack: SeatingPlanSection[] = []
    redoHistoryStack: SeatingPlanSection[] = []
    maxHistoryStack = 5000

    //@Watch('seatingPlanSection')
    //onSeatingPlanSectionChanged() {
    //    this.clonedSeatingPlanSection = this.seatingPlanSection.clone()
    //    this.clonedSeatingPlanSection.updatePositions(this.sizeConfig)
    //}
    
    activated() {
        console.log('activated')
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
        document.addEventListener("click", this.onDocumentClick);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
        document.removeEventListener("click", this.onDocumentClick);
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }

        this.clonedSeatingPlanSection.updatePositions(this.sizeConfig)

        document.addEventListener("keydown", this.onKey);
        document.addEventListener("click", this.onDocumentClick);
    }

    beforeDestroy() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }

        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
        document.removeEventListener("click", this.onDocumentClick);
        
    }

    validate() {
        this.errorBox = null
        const errors = new SimpleErrors()

        for (const [index, row] of this.rows.entries()) {
            if (this.isRowInvalid(row)) {

                errors.addError(new SimpleError({
                    code: "invalid_row",
                    message: `De ${index + 1}${index > 2 ? 'de' : 'ste'} rij (van boven) is ongeldig. Kijk of de rij een letter/cijfer heeft gekregen en of die uniek is.`
                }))
            } else {
                for (const [seatIndex, seat] of row.seats.entries()) {
                    if (this.isSeatInvalid(row, seat)) {
                        errors.addError(new SimpleError({
                            code: "invalid_seat",
                            message: `De ${index + 1}${index > 2 ? 'de' : 'ste'} rij (van boven) bevat een ongeldige zetel op plaats ${seatIndex + 1} vanaf links. Kijk of de zetel een letter/cijfer heeft gekregen en of die uniek is.`
                        }))
                    }
                
                }
            }
        }

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
            return false
        }

        return true;
    }

    onDocumentClick(event: MouseEvent) {
        if (!this.selectedRow) {
            return;
        }
        const selectedRowElements = this.$refs["row-" + this.selectedRow.uuid] as HTMLElement[]
        
        // Check event is inside the selected row
        if (selectedRowElements && selectedRowElements.length === 1 && event.target && !selectedRowElements[0].contains(event.target as Node)) {
            this.selectedRow = null
        } 
    }

    onKey(event: KeyboardEvent) {
        if (event.key === "Backspace" && this.selectedRow !== null) {
            this.backspaceRow(this.selectedRow, event)
        }

        // Arrow down
        if (event.key === "Enter" && this.selectedRow !== null) {
            const seat = this.getSelectedSeat()
            if (seat) {
                // Default behaviour
                return;
            } 
            // Insert new seat in row
            this.insertSeat(this.selectedRow, null, event)
            return;
        }

        // Arrow down
        if (event.key === "ArrowDown" && this.selectedRow !== null) {
            event.preventDefault(); // prevent scroll

            const seat = this.getSelectedSeat()
            if (seat) {
                // More complex
                const newSeat = this.getSeatAt(seat.x + seat.width / 2, seat.y + seat.height + seat.height / 2)
                if (newSeat) {
                    this.selectSeat(newSeat)
                    return;
                }
                this.blurAll()
            } 
            const index = this.clonedSeatingPlanSection.rows.indexOf(this.selectedRow)
            if (index >= 0 && index < this.clonedSeatingPlanSection.rows.length - 1) {
                this.selectRow(event, this.clonedSeatingPlanSection.rows[index + 1])
            }
        }

        // Arrow up
        if (event.key === "ArrowUp" && this.selectedRow !== null) {
            event.preventDefault(); // prevent scroll

            const seat = this.getSelectedSeat()
            if (seat) {
                // More complex
                const newSeat = this.getSeatAt(seat.x + seat.width / 2, seat.y - seat.height / 2)
                if (newSeat) {
                    this.selectSeat(newSeat)
                    return;
                }
                this.blurAll()
            }
            const index = this.clonedSeatingPlanSection.rows.indexOf(this.selectedRow)
            if (index > 0) {
                this.selectRow(event, this.clonedSeatingPlanSection.rows[index - 1])
            }
        }

        // Arrow left
        if (event.key === "ArrowLeft" && this.selectedRow !== null) {
            event.preventDefault(); // prevent scroll

            const seat = this.getSelectedSeat()
            if (seat) {
                const index = this.selectedRow.seats.indexOf(seat)
                if (index > 0) {
                    this.selectSeat(this.selectedRow.seats[index - 1])
                }
            }
        }

        // Arrow right
        if (event.key === "ArrowRight" && this.selectedRow !== null) {
            event.preventDefault(); // prevent scroll

            const seat = this.getSelectedSeat()
            if (seat) {
                const index = this.selectedRow.seats.indexOf(seat)
                if (index >= 0 && index < this.selectedRow.seats.length - 1) {
                    this.selectSeat(this.selectedRow.seats[index + 1])
                }
            }
        }
    }

    getSelectedSeat() {
        const active = document.activeElement
        if (active && active.getAttribute("data-uuid")) {
            const uuid = active.getAttribute("data-uuid")

            for (const row of this.rows) {
                for (const seat of row.seats) {
                    if (seat.uuid === uuid) {
                        return seat
                    }
                }
            }
        }

        return null
    }

    getSeatColor(seat: SeatingPlanSeat) {
        return this.seatingPlan.getSeatColor(seat)
    }

    getSeatAt(x: number, y: number) {
        for (const row of this.rows) {
            if (row.y <= y && row.y + row.height >= y) {
                // It should be this row, no other
                for (const seat of row.seats) {
                    if (seat.x + seat.width >= x) {
                        return seat
                    }
                }

                // Return last seat
                return row.seats[row.seats.length - 1] ?? null
            }
        }
        return null
    }

    emitChange(options: {adjustHistory?: boolean} = {}) {
        // We use seatingPlanSection for the history stack because this one won't be changed already
        if (options.adjustHistory !== false) {
            this.historyStack.push(this.seatingPlanSection.clone())

            // clear redo stack
            this.redoHistoryStack = []
        }

        this.clonedSeatingPlanSection.updatePositions(this.sizeConfig);

        const seatingPlanPatch = SeatingPlan.patch({id: this.seatingPlan.id})
        seatingPlanPatch.sections.addPatch(SeatingPlanSection.patch({
            id: this.seatingPlanSection.id,
            rows: this.clonedSeatingPlanSection.rows.map(r => r.clone()) as any
        }))
        this.$emit("patch", seatingPlanPatch)
    }

    canUndo() {
        return this.historyStack.length > 0
    }

    undo() {
        if (!this.canUndo()) {
            return
        }
        const last = this.historyStack.pop()
        if (last) {
            this.redoHistoryStack.push(this.clonedSeatingPlanSection.clone())
            this.clonedSeatingPlanSection = last
            this.emitChange({adjustHistory: false})
        }
    }

    canRedo() {
        return this.redoHistoryStack.length > 0
    }

    redo() {
        if (!this.canRedo()) {
            return
        }
        const last = this.redoHistoryStack.pop()
        if (last) {
            this.historyStack.push(this.clonedSeatingPlanSection.clone())
            this.clonedSeatingPlanSection = last
            this.emitChange({adjustHistory: false})
        }
    }

    get sizeConfig() {
        return new SeatingSizeConfiguration({
            seatWidth: 28,
            seatHeight: 28,
            seatXSpacing: 3,
            seatYSpacing: 10
        })
    }

    get size() {
        return this.clonedSeatingPlanSection.calculateSize(this.sizeConfig)
    }
 
    get rows() {
        return this.clonedSeatingPlanSection.rows
    }

    get invertedRows() {
        return this.clonedSeatingPlanSection.rows
    }

    addRow() {
        const lastIds = this.clonedSeatingPlanSection.rows.map(r => r.label).reverse()
        const label = getNextPattern(lastIds)

        const row = SeatingPlanRow.create({
            label,
            seats: []
        });
        this.clonedSeatingPlanSection.rows.unshift(row)
        this.emitChange()
    }

    addRightSeat(row: SeatingPlanRow) {
        const lastIds = row.seats.map(s => s.label)
        const label = getNextPattern(lastIds)

        row.seats.push(SeatingPlanSeat.create({
            label,
            category: this.seatingPlan.categories[0]?.id ?? null
        }))
        this.emitChange()
    }

    addLeftSeat(row: SeatingPlanRow) {
        const lastIds = row.seats.map(s => s.label).reverse()
        const label = getNextPattern(lastIds)

        row.seats.unshift(SeatingPlanSeat.create({
            label,
            category: this.seatingPlan.categories[0]?.id ?? null
        }))
        this.emitChange()
    }

    selectRow(event, row: SeatingPlanRow) {
        this.selectedRow = row;
    }

    isRowSelected(row: SeatingPlanRow) {
        return this.selectedRow === row
    }

    selectInput(event: Event) {
        const input = event.target as HTMLInputElement
        // Check input is INPUT otherwise select child
        if (input.tagName !== "INPUT") {
            const childInput = input.querySelector("input")
            if (childInput) {
                childInput.select()
            }
            return
        }
        input.select()
    }

    isRowInvalid(row: SeatingPlanRow,) {
        if (!row.label) {
            // Should have no non-space seats
            return !!row.seats.find(s => !s.isSpace)
        }

        // Should not have a row with the same label
        const slug = Formatter.slug(row.label)
        return this.clonedSeatingPlanSection.rows.filter(r => Formatter.slug(r.label) === slug).length > 1 // Row is also included, so should be 1
    }

    isSeatInvalid(row: SeatingPlanRow, seat: SeatingPlanSeat) {
        return !seat.isSpace && (Formatter.slug(seat.label).length === 0 || row.seats.filter(s => !s.isSpace && Formatter.slug(s.label) === Formatter.slug(seat.label)).length > 1)
    }

    setSeat(row: SeatingPlanRow, seat: SeatingPlanSeat, value: string) {
        seat.label = value
        this.emitChange()
    }

    insertSeat(row: SeatingPlanRow, seat: SeatingPlanSeat|null, event: KeyboardEvent) {
        // Insert a seat in the row
        const index = seat === null ? (row.seats.length - 1) : row.seats.indexOf(seat)
        if (seat === null || index >= 0) {
            const previousIds = row.seats.slice(0, index + 1).map(s => s.label)
            const label = getNextPattern(previousIds)

            const newSeat = SeatingPlanSeat.create({
                label,
                category: seat?.category ?? this.seatingPlan.categories[0]?.id ?? null
            })
            row.seats.splice(index + 1, 0, newSeat)
            this.emitChange()

            this.$nextTick(() => {
                this.$nextTick(() => {
                    this.selectSeat(newSeat)
                });
            });
        }

        // We handled the event, don't change the input
        event.preventDefault()
    }

    selectSeat(seat: SeatingPlanSeat) {
        const ref = this.$refs["seat-input-" + seat.uuid] as HTMLInputElement[]
        if (ref && ref.length === 1) {
            ref[0].select()

            const row = this.clonedSeatingPlanSection.rows.find(r => r.seats.includes(seat))
            if (row) {
                this.selectRow(null, row)
            }
        } else {
            console.warn("Could not find input " + seat.uuid)
        }
    }

    backspaceRow(row: SeatingPlanRow, event) {
        // Delete the row
        const index = this.clonedSeatingPlanSection.rows.indexOf(row)
        if (index >= 0) {
            this.clonedSeatingPlanSection.rows.splice(index, 1)
            this.emitChange();
        
            // Focus the previous row, or next row (if it was first)
            const newRow = this.clonedSeatingPlanSection.rows[index - 1] ?? this.clonedSeatingPlanSection.rows[index]
            if (newRow) {
                this.selectRow(event, newRow)
            }
        }

        // We handled the event, don't change the input
        event.preventDefault()
    }

    backspaceSeat(row: SeatingPlanRow, seat: SeatingPlanSeat, event: KeyboardEvent) {
        if (seat.isSpace || seat.label.length > 0) {
            return
        }
        // Delete the seat from the row
        const index = row.seats.indexOf(seat)
        if (index >= 0) {
            row.seats.splice(index, 1)
            this.emitChange();
        
            // Focus the previous seat, or next seat (if it was first)
            const newSeat = row.seats[index - 1] ?? row.seats[index]
            if (newSeat) {
                this.selectSeat(newSeat)
            }
        }

        // We handled the event, don't change the input
        event.preventDefault()
    }

    isDisabledPersonSeat(seat: SeatingPlanSeat) {
        return seat.markings.includes(SeatMarkings.DisabledPerson)
    }

    blurAll() {
        const el = document.activeElement as HTMLElement
        if (el) {
            el.blur()
        }
    }

    getInsertMenu(row: SeatingPlanRow, seatIndex: number) {
        return new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Zetel',
                    icon: 'seat',
                    action: () => {
                        if (seatIndex >= 0) {
                            let previousIds = row.seats.slice(0, seatIndex).map(s => s.label)
                            if (previousIds.length === 0) {
                                // next ids, reversed
                                previousIds = row.seats.slice(seatIndex).map(s => s.label).reverse()
                            }
                            const label = getNextPattern(previousIds)
                            row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                label,
                                category: this.seatingPlan.categories[0]?.id ?? null
                            }))
                            this.emitChange()
                        }
                        return true;
                    }
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
                                            category: this.seatingPlan.categories[0]?.id ?? null
                                        }))
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: '2',
                                action: () => {
                                    if (seatIndex >= 0) {
                                        row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                            blockWidth: 4,
                                            type: SeatType.Space,
                                            category: this.seatingPlan.categories[0]?.id ?? null
                                        }))
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: '3',
                                action: () => {
                                    if (seatIndex >= 0) {
                                        row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                            blockWidth: 6,
                                            type: SeatType.Space,
                                            category: this.seatingPlan.categories[0]?.id ?? null
                                        }))
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: '4',
                                action: () => {
                                    if (seatIndex >= 0) {
                                        row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                            blockWidth: 8,
                                            type: SeatType.Space,
                                            category: this.seatingPlan.categories[0]?.id ?? null
                                        }))
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: 'Automatisch',
                                description: 'Neemt de volledige beschikbare ruimte in',
                                action: () => {
                                    if (seatIndex >= 0) {
                                        row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                            grow: 1,
                                            type: SeatType.Space,
                                            category: this.seatingPlan.categories[0]?.id ?? null
                                        }))
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                        ]
                    ])
                })
            ]
        ]);
    }

    openContextMenu(event, row: SeatingPlanRow, seat?: SeatingPlanSeat) {
        const contextMenu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Rij dupliceren',
                    icon: 'copy',
                    action: () => {
                        const clonedRow = row.clone()

                        const previousIds = this.clonedSeatingPlanSection.rows.slice(this.clonedSeatingPlanSection.rows.indexOf(row)).map(r => r.label).reverse()
                        const label = getNextPattern(previousIds)
                        clonedRow.label = label
                        const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                        if (index >= 0) {
                            this.clonedSeatingPlanSection.rows.splice(index, 0, clonedRow)
                            this.emitChange()
                        }
                        return true;
                    }
                }),

                new ContextMenuItem({
                    name: 'Verplaats rij naar boven',
                    icon: 'arrow-up',
                    disabled: this.clonedSeatingPlanSection.rows.indexOf(row) <= 0,
                    action: () => {
                        const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                        if (index >= 0 && index > 0) {
                            this.clonedSeatingPlanSection.rows.splice(index - 1, 0, row)
                            this.clonedSeatingPlanSection.rows.splice(index + 1, 1)
                            this.emitChange()
                        }
                        return true;
                        
                    }
                }),
                new ContextMenuItem({
                    name: 'Verplaats rij naar beneden',
                    icon: 'arrow-down',
                    disabled: this.clonedSeatingPlanSection.rows.indexOf(row) >= this.clonedSeatingPlanSection.rows.length - 1,
                    action: () => {
                        const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                        if (index >= 0 && index < this.clonedSeatingPlanSection.rows.length - 1) {
                            this.clonedSeatingPlanSection.rows.splice(index + 2, 0, row)
                            this.clonedSeatingPlanSection.rows.splice(index, 1)
                            this.emitChange()
                        }
                        return true;
                    }
                }),
                new ContextMenuItem({
                    name: 'Rij verwijderen',
                    icon: 'trash',
                    action: () => {
                        const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                        if (index >= 0) {
                            this.clonedSeatingPlanSection.rows.splice(index, 1)
                            this.emitChange()
                        }
                        return true;
                    }
                })
            ],
            (seat ? [
                new ContextMenuItem({
                    name: 'Zetel verplaatsen',
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: 'Links',
                                icon: 'arrow-left',
                                disabled: row.seats.indexOf(seat) <= 0,
                                action: () => {
                                    const index = row.seats.indexOf(seat)
                                    if (index > 0) {
                                        row.seats.splice(index, 1)
                                        row.seats.splice(index - 1, 0, seat)
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: 'Rechts',
                                icon: 'arrow-right',
                                disabled: row.seats.indexOf(seat) >= row.seats.length - 1,
                                action: () => {
                                    const index = row.seats.indexOf(seat)
                                    if (index >= 0 && index < row.seats.length - 1) {
                                        row.seats.splice(index, 1)
                                        row.seats.splice(index + 1, 0, seat)
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            })
                        ]
                    ])
                }),
                new ContextMenuItem({
                    name: 'Invoegen',
                    icon: 'add',
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: 'Links',
                                childMenu: this.getInsertMenu(row, row.seats.indexOf(seat))
                            }),
                            new ContextMenuItem({
                                name: 'Rechts',
                                childMenu: this.getInsertMenu(row, row.seats.indexOf(seat) + 1)
                            })
                        ]
                    ])
                }),
                new ContextMenuItem({
                    name: 'Breedte',
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: '1',
                                action: () => {
                                    seat.blockWidth = 2
                                    seat.grow = 0
                                    this.emitChange()
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: '2',
                                action: () => {
                                    seat.blockWidth = 2 * 2
                                    seat.grow = 0
                                    this.emitChange()
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: '3',
                                action: () => {
                                    seat.blockWidth = 2 * 3
                                    seat.grow = 0
                                    this.emitChange()
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: '4',
                                action: () => {
                                    seat.blockWidth = 2 * 4
                                    seat.grow = 0
                                    this.emitChange()
                                    return true;
                                }
                            })
                        ],
                        [
                            new ContextMenuItem({
                                name: 'Automatisch',
                                description: 'Groei automatisch om de volledige rij te vullen',
                                action: () => {
                                    seat.blockWidth = 2
                                    seat.grow = 1
                                    this.emitChange()
                                    return true;
                                }
                            })
                        ]
                    ])
                }),
                new ContextMenuItem({
                    name: 'Type',
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: 'Zetel',
                                action: () => {
                                    seat.type = SeatType.Seat
                                    this.emitChange()
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: 'Gang',
                                action: () => {
                                    seat.type = SeatType.Space
                                    this.emitChange()
                                    return true;
                                }
                            }),
                        ]
                    ])
                }),
                new ContextMenuItem({
                    name: 'Markeringen',
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: 'Mindervalide plaats',
                                icon: 'disabled-person',
                                selected: seat.markings.includes(SeatMarkings.DisabledPerson),
                                action: () => {
                                    if (!seat.markings.includes(SeatMarkings.DisabledPerson)) {
                                        seat.markings.push(SeatMarkings.DisabledPerson)
                                    } else {
                                        seat.markings = seat.markings.filter(m => m !== SeatMarkings.DisabledPerson)
                                    }
                                    this.emitChange()
                                    return true;
                                }
                            })
                        ]
                    ])
                }),
                new ContextMenuItem({
                    name: 'Zetel verwijderen',
                    icon: 'trash',
                    action: () => {
                        const index = row.seats.indexOf(seat)
                        if (index >= 0) {
                            row.seats.splice(index, 1)
                            this.emitChange()
                        }
                        return true;
                    }
                }),
            ] : []),
            this.seatingPlan.categories.map(category => {
                let allMatching = true;
                let oneMatching = false;

                if (!seat) {
                    for (const seat of row.seats) {
                        if (seat.category !== category.id) {
                            allMatching = false;
                        } else {
                            oneMatching = true;
                        }
                    }
                } else {
                    if (seat.category !== category.id) {
                        allMatching = false;
                    } else {
                        oneMatching = true;
                    }
                }


                return new ContextMenuItem({
                    name: category.name,
                    selected: allMatching||oneMatching,
                    action: () => {
                        if (!seat) {
                            for (const seat of row.seats) {
                                seat.category = category.id
                            }
                        } else {
                            seat.category = category.id
                        }
                        this.emitChange()
                        return true;
                    }
                });
            })
        ])
        contextMenu.show({
            clickEvent: event
        }).catch(console.error)
    }
    
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
    overflow-x: scroll;
    margin-bottom: 10px;
    transform: translate3d(0,0,0); // fixes drawing rounding issues, and makes sure the seating section is drawn on its own before rendering in the page

    .padding-box {
        padding: 20px 90px;
    }

    .seating-plan-seats {
        position: relative;
        width: var(--sw);
        height: var(--sh);
        margin: 0 auto;
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

        &.selected {
            cursor: inherit;
            border-color: $color-primary;
            background: $color-primary-background;
            z-index: 0;

           
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

            &:focus, &:focus-within {
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
            font-size: 12px;
            text-align: left;
            line-height: 18px;
            height: 18px;
            padding: 4px;
        }
    }

    .seat > .icon {
        position: absolute;
        left: calc((var(--w) - 24px) / 2);
        top: calc((var(--h) - 24px) / 2);
        z-index: 0;
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
    }
}

</style>
