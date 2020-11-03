<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div>Keuze uit afhaaltijdstippen</div>
            <div>
                <button class="button text" @click="addTimeSlot">
                    <span class="icon add" />
                    <span>Keuze</span>
                </button>
            </div>
        </h2>
        <p>Er moet nu geen tijdstip geselecteerd worden bij het plaatsen van een bestelling. Het tijdstip is dus onbepaald en kan je verduidelijken in je beschrijving (bv. na activiteiten afhalen). Dit is handig als het niet echt uitmaakt wanneer ze het komen afhalen (bv. voor kleren). Voeg tijdstippen toe om men een afhaaltijdstip te laten kiezen. </p>
    
        <STList>
            <STListItem v-for="timeSlot in timeSlots.timeSlots" :key="timeSlot.id" :selectable="true" @click="editTimeSlot(timeSlot)" class="right-description">
                {{ timeSlot.date | date }}

                <template slot="right">
                    {{ timeSlot.startTime | minutes }}
                    - {{ timeSlot.endTime | minutes }}
                    <span  class="icon arrow-right-small gray"/>
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, STListItem, STList, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
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
    timeSlots!: WebshopTimeSlots

    addPatch(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
        this.$emit("patch", patch)
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
