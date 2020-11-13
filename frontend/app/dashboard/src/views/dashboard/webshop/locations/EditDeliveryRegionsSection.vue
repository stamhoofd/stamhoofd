<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div>Leveringsgebied</div>
            <div>
                <button class="button text" @click="addRegion">
                    <span class="icon add" />
                    <span>Toevoegen</span>
                </button>
            </div>
        </h2>
        <p>Je kan meerdere gebieden toevoegen waarin je wilt leveren.</p>
    
        <p class="info-box" v-if="deliveryMethod.regions.length == 0">Je hebt geen leveringsgebieden toegevoegd, de levering is dus overal.</p>

        <STList>
            <STListItem v-for="region in sortedRegions" :key="region.id" class="right-description">
                {{ region.name }}

                <template slot="right">
                    <span class="icon trash"/>
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, STListItem, STList, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { WebshopDeliveryMethod } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";
import EditRegionView from './EditRegionView.vue';
import EditTimeSlotView from './EditTimeSlotView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STListItem,
        STList,
    }
})
export default class EditDeliveryregionsSection extends Mixins(NavigationMixin) {
  
    @Prop({ required: true })
    deliveryMethod!: WebshopDeliveryMethod

    

    addPatch(patch: AutoEncoderPatchType<WebshopDeliveryMethod>) {
        this.$emit("patch", patch)
    }

    get sortedRegions() {
        return this.deliveryMethod.regions
    }
   
    addRegion() {
        const region = WebshopDeliveryRegion.create({
            country: "BE"
        })
        const p = WebshopDeliveryMethod.patch({})
        p.regions.addPut(region)
        
        this.present(new ComponentWithProperties(EditRegionView, { region, saveHandler: (patch: PatchableArrayAutoEncoder<WebshopDeliveryRegion>) => {
            // Merge both patches
            p.regions.merge(patch)
            this.addPatch(p)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    editRegion(region: WebshopDeliveryRegion) {
        this.present(new ComponentWithProperties(EditRegionView, { region, saveHandler: (patch: PatchableArrayAutoEncoder<WebshopDeliveryRegion>) => {
            // Merge both patches
            const p = WebshopDeliveryMethod.patch({})
            p.regions.merge(patch)
            this.addPatch(p)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }
    
}
</script>
