<template>
    <div class="edit-seating-plan-section-box" data-disable-enter-focus>
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
                            v-model="row.id" 
                            class="row-label left"
                            @click.prevent="selectInput" 
                        >
                        <input 
                            v-model="row.id" 
                            class="row-label right"
                            @click.prevent="selectInput" 
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
                                }"
                                @click.prevent="selectInput" 
                                @contextmenu.prevent.stop="openContextMenu($event, row, seat)"
                            >
                                <input 
                                    :ref="'seat-input-' + seat.uuid" 
                                    :data-uuid="seat.uuid"
                                    :value="seat.id" 
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
            Gebruik de rechtermuisknop op een rij of stoel om deze te verwijderen of te dupliceren. Wijzig een stoelnummer door deze aan te klikken en te typen. Maak het stoelnummer leeg om een gang te maken. Klik een rijnummer aan om die te wijzigen.
        </p>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components';
import { SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatingSizeConfiguration, SeatMarkings, SeatType } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        
    },
})
export default class EditSeatingPlanSectionBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        seatingPlan!: SeatingPlan

    @Prop({ required: true })
        seatingPlanSection!: SeatingPlanSection

    clonedSeatingPlanSection = this.seatingPlanSection.clone()

    selectedRow: SeatingPlanRow | null = null
    
    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event: KeyboardEvent) {
        if (event.key === "Backspace" && this.selectedRow !== null) {
            this.backspaceRow(this.selectedRow, event)
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

    getSeatAt(x: number, y: number) {
        console.log("get seat at", x, y)

        for (const row of this.rows) {
            if (row.y <= y && row.y + row.height >= y) {
                console.log("found row", row)

                // It should be this row, no other
                for (const seat of row.seats) {
                    if (seat.x + seat.width >= x) {
                        console.log("found seat", seat)
                        return seat
                    }
                }

                // Return last seat
                return row.seats[row.seats.length - 1] ?? null
            }
        }
        return null
    }

    mounted() {
        this.clonedSeatingPlanSection.updatePositions(this.sizeConfig)
    }

    emitChange() {
        this.clonedSeatingPlanSection.updatePositions(this.sizeConfig);
        const seatingPlanPatch = SeatingPlan.patch({id: this.seatingPlan.id})
        seatingPlanPatch.sections.addDelete(this.seatingPlanSection.id)
        seatingPlanPatch.sections.addPut(this.clonedSeatingPlanSection)
        this.$emit("patch", seatingPlanPatch)
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

    calculateNextRow(row?: SeatingPlanRow) {
        // Search a pattern in the rows
        if (!row) {
            return "A"
        }

        const lastRow = row
        const lastRowLabel = lastRow.id

        if (lastRowLabel.length === 0) {
            return ""
        }

        let nextRow = this.getNextRowFor(lastRowLabel)

        // Make sure it is unique
        while (this.clonedSeatingPlanSection.rows.find(r => r.id === nextRow)) {
            nextRow = this.getNextRowFor(nextRow)
        }
        return nextRow
    }

    calculatePreviousRow(row?: SeatingPlanRow) {
        // Search a pattern in the rows
        if (!row) {
            return "A"
        }

        const lastRow = row
        const lastRowLabel = lastRow.id

        if (lastRowLabel.length === 0) {
            return ""
        }

        let nextRow = this.getPreviousRowFor(lastRowLabel)

        // Make sure it is unique
        while (this.clonedSeatingPlanSection.rows.find(r => r.id === nextRow)) {
            nextRow = this.getPreviousRowFor(nextRow)
        }
        return nextRow
    }

    getNextRowFor(lastRowLabel: string) {
        if (parseInt(lastRowLabel) > 0) {
            return (parseInt(lastRowLabel) + 1).toString()
        }
        const wasUppercase = lastRowLabel.toUpperCase() === lastRowLabel
        lastRowLabel = lastRowLabel.toLowerCase()

        // Return a, b, c ..., z, aa, ab, ac, ...
        let nextRow = ""
        for (let i = lastRowLabel.length - 1; i >= 0; i--) {
            const char = lastRowLabel[i]
            if (char === "z") {
                nextRow = "a" + nextRow
            } else {
                nextRow = String.fromCharCode(char.charCodeAt(0) + 1) + nextRow
                break
            }
        }

        return wasUppercase ? nextRow.toUpperCase() : nextRow
    }

    getPreviousRowFor(lastRowLabel: string) {
        if (parseInt(lastRowLabel) > 0) {
            return (parseInt(lastRowLabel) - 1).toString()
        }
        const wasUppercase = lastRowLabel.toUpperCase() === lastRowLabel
        lastRowLabel = lastRowLabel.toLowerCase()

        // Return a, b, c ..., z, aa, ab, ac, ...
        let nextRow = ""
        for (let i = lastRowLabel.length - 1; i >= 0; i--) {
            const char = lastRowLabel[i]
            if (char === "a") {
                nextRow = "z" + nextRow
            } else {
                nextRow = String.fromCharCode(char.charCodeAt(0) - 1) + nextRow
                break
            }
        }

        return wasUppercase ? nextRow.toUpperCase() : nextRow
    }

    addRow() {
        const row = SeatingPlanRow.create({
            id: this.calculateNextRow(this.clonedSeatingPlanSection.rows[this.clonedSeatingPlanSection.rows.length - 1]),
            seats: []
        });
        this.clonedSeatingPlanSection.rows.push(row)
        this.emitChange()
    }

    addRightSeat(row: SeatingPlanRow) {
        row.seats.push(SeatingPlanSeat.create({
            // todo
            id: (row.seats.length + 1).toString()
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
        console.log("select input")
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

    isSeatInvalid(row: SeatingPlanRow, seat: SeatingPlanSeat) {
        return !seat.isSpace && row.seats.filter(s => !s.isSpace && s.id === seat.id).length > 1
    }

    setSeat(row: SeatingPlanRow, seat: SeatingPlanSeat, value: string) {
        seat.id = value
        this.emitChange()
    }

    insertSeat(row: SeatingPlanRow, seat: SeatingPlanSeat, event: KeyboardEvent) {
        // Insert a seat in the row
        const index = row.seats.indexOf(seat)
        if (index >= 0) {
            const newSeat = SeatingPlanSeat.create({
                // todo: change algorithm
                id: (index + 2).toString()
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
        if (seat.isSpace || seat.id.length > 0) {
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
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: 'Eén',
                                action: () => {
                                    if (seatIndex >= 0) {
                                        row.seats.splice(seatIndex, 0, SeatingPlanSeat.create({
                                            id: (seatIndex + 1).toString()
                                        }))
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: 'Meerdere...',
                                action: () => {
                                    // todo: input menu
                                    return true;
                                }
                            })
                        ]
                    ])
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
                                            id: '',
                                            type: SeatType.Space,
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
                                            id: '',
                                            blockWidth: 4,
                                            type: SeatType.Space,
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
                                            id: '',
                                            blockWidth: 6,
                                            type: SeatType.Space,
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
                                            id: '',
                                            blockWidth: 8,
                                            type: SeatType.Space,
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
                                            id: '',
                                            grow: 1,
                                            type: SeatType.Space,
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
        if (!seat) {
            this.selectRow(event, row)
        }

        const contextMenu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Rij dupliceren',
                    icon: 'copy',
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: 'Boven',
                                icon: 'arrow-up',
                                action: () => {
                                    const clonedRow = row.clone()
                                    clonedRow.id = this.calculateNextRow(clonedRow)
                                    const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                                    if (index >= 0) {
                                        this.clonedSeatingPlanSection.rows.splice(index + 1, 0, clonedRow)
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            }),
                            new ContextMenuItem({
                                name: 'Onder',
                                icon: 'arrow-down',
                                action: () => {
                                    const clonedRow = row.clone()
                                    clonedRow.id = this.calculatePreviousRow(clonedRow)
                                    const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                                    if (index >= 0) {
                                        this.clonedSeatingPlanSection.rows.splice(index, 0, clonedRow)
                                        this.emitChange()
                                    }
                                    return true;
                                }
                            })
                        ]
                    ])
                }),
                new ContextMenuItem({
                    name: 'Rij verplaatsen',
                    icon: 'copy',
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: 'Boven',
                                icon: 'arrow-up',
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
                                name: 'Onder',
                                icon: 'arrow-down',
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
                            })
                        ]
                    ])
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
                            }),
                            new ContextMenuItem({
                                name: 'Onder',
                                childMenu: new ContextMenu([
                                    [
                                        new ContextMenuItem({
                                            name: 'Dupliceer rij',
                                            action: () => {
                                                const clonedRow = row.clone()
                                                clonedRow.id = this.calculateNextRow(clonedRow)
                                                const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                                                if (index >= 0) {
                                                    this.clonedSeatingPlanSection.rows.splice(index + 1, 0, clonedRow)
                                                    this.emitChange()
                                                }
                                                return true;
                                            }
                                        }),
                                        new ContextMenuItem({
                                            name: 'Gang / lege rij',
                                            action: () => {
                                                const newRow = SeatingPlanRow.create({
                                                    id: '',
                                                    seats: []
                                                })
                                                const index = this.clonedSeatingPlanSection.rows.indexOf(row)
                                                if (index >= 0) {
                                                    this.clonedSeatingPlanSection.rows.splice(index + 1, 0, newRow)
                                                    this.emitChange()
                                                }
                                                return true;
                                            }
                                        }),
                                    ]
                                ])
                            }),
                            new ContextMenuItem({
                                name: 'Boven',
                                childMenu: this.getInsertMenu(row, row.seats.indexOf(seat) + 1)
                            })
                        ]
                    ])
                }),
                new ContextMenuItem({
                    name: 'Breedte',
                    icon: 'add',
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
            ] : [])
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
        bottom: var(--ry);
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

    .stage {
        background: white;
        width: 80%;
        height: 40px;
        margin: 0 auto;
        margin-top: 30px;
        border-top-left-radius: $border-radius;
        border-top-right-radius: $border-radius;
        text-align: center;
        line-height: 40px;
        @extend .style-description;
        
    }

    .button-row {
        display: flex;
        align-items: center;
        justify-content: center;
    }
}

</style>
