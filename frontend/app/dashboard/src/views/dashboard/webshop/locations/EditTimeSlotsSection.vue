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
        <p>Bij het plaatsen van bestellingen kan er gekozen worden tussen verschillende afhaaltijdstippen (als je meerdere keuzes toevoegt), ligt het afhaaltijdstip vast (als je er één hebt) of is het afhaaltijdstip onbepaald (geen keuzes). Dat laatste is handig als je bijvoorbeeld voor of na activiteiten kan afhalen; zet dit dan wel in de beschrijving.</p>
    
        <p class="info-box" v-if="timeSlots.timeSlots.length == 0">Je hebt geen afhaaltijdstippen toegevoegd, dus er moet geen keuze gemaakt worden. Het afhaaltijdstip van een bestelling is 'onbepaald'. Voeg één of meer keuzes toe als je het afhalen op vaste tijdstippen wilt organiseren.</p>
        <p class="info-box" v-if="timeSlots.timeSlots.length == 1">Er is maar één keuze, dus we communiceren dit tijdstip gewoon i.v.p. een keuze te geven.</p>

        <STList>
            <STListItem v-for="timeSlot in sortedSlots" :key="timeSlot.id" :selectable="true" @click="editTimeSlot(timeSlot)" class="right-description">
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

    get sortedSlots() {
        return this.timeSlots.timeSlots.sort(WebshopTimeSlot.sort)
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
