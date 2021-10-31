<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div>
                {{ title }}
            </div>
            <div>
                <button class="button text" @click="addTimeSlot">
                    <span class="icon add" />
                    <span>Keuze</span>
                </button>
            </div>
        </h2>
        <slot />
    
        <p v-if="timeSlots.timeSlots.length == 0" class="info-box">
            Je hebt geen intervallen toegevoegd, dus er moet geen keuze gemaakt worden.
        </p>
        <p v-if="timeSlots.timeSlots.length == 1" class="info-box">
            Er is maar één keuze, dus we communiceren dit interval i.v.p. een keuze te geven.
        </p>

        <STList>
            <STListItem v-for="timeSlot in sortedSlots" :key="timeSlot.id" :selectable="true" class="right-description" @click="editTimeSlot(timeSlot)">
                {{ timeSlot.date | date }}

                <template slot="right">
                    {{ timeSlot.startTime | minutes }}
                    - {{ timeSlot.endTime | minutes }}
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { WebshopTimeSlot, WebshopTimeSlots } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditTimeSlotView from './EditTimeSlotView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STListItem,
        STList,
    },
    filters: {
        date: Formatter.date.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class EditTimeSlotsSection extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    title!: string

    @Prop({ required: true })
    timeSlots!: WebshopTimeSlots

    addPatch(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
        this.$emit("patch", patch)
    }

    get sortedSlots() {
        return this.timeSlots.timeSlots.slice().sort(WebshopTimeSlot.sort)
    }
   
    addTimeSlot() {
        const timeSlot = WebshopTimeSlot.create({
            date: new Date()
        })
        const p = WebshopTimeSlots.patch({})
        p.timeSlots.addPut(timeSlot)
        
        this.present(new ComponentWithProperties(EditTimeSlotView, { timeSlots: this.timeSlots.patch(p), timeSlot, saveHandler: (patch: AutoEncoderPatchType<WebshopTimeSlots>) => {
            // Merge both patches
            this.addPatch(p.patch(patch))

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    editTimeSlot(timeSlot: WebshopTimeSlot) {
        this.present(new ComponentWithProperties(EditTimeSlotView, { timeSlots: this.timeSlots, timeSlot, saveHandler: (patch: AutoEncoderPatchType<WebshopTimeSlots>) => {
            this.addPatch(patch)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }
    
}
</script>
