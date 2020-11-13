<template>
    <div class="st-view region-edit-view">
        <STNavigationBar :title="isNew ? 'Leveringsgebied toevoegen' : 'Leveringsgebied bewerken'">
            <template slot="right">
                <button class="button text" v-if="!isNew" @click="deleteMe">
                    <span class="icon trash"/>
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Leveringsgebied toevoegen
            </h1>
            <h1 v-else>
                Leveringsgebied bewerken
            </h1>
          
            <STErrorsDefault :error-box="errorBox" />

            <h2>Gebied</h2>

            <template v-if="">

            </template>

        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Radio, Validator, CenteredMessage, RadioGroup } from "@stamhoofd/components";
import { Version, WaitingListType, Webshop, WebshopDeliveryRegion, WebshopTimeSlot, WebshopTimeSlots } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        STList
    },
})
export default class EditRegionView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    region!: WebshopDeliveryRegion

    patchRegion: AutoEncoderPatchType<WebshopDeliveryRegion> = WebshopDeliveryRegion.patch({ id: this.region.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: PatchableArrayAutoEncoder<WebshopDeliveryRegion>) => void);

    cachedType = this.type

    get patchedRegion() {
        return this.region.patch(this.patchRegion)
    }

    get isNew() {
        return false
    }

    get type() {
        if (this.cachedType) {
            return this.cachedType
        }
        if (this.patchRegion.city) {
            return "city"
        }

        if (this.patchRegion.province) {
            return "province"
        }

        return "country"
    }

    set type(type: string) {
        this.cachedType = type
    }

    addPatch(patch: AutoEncoderPatchType<WebshopDeliveryRegion>) {
        this.patchRegion = this.patchRegion.patch(patch)
    }

    async save() {
        if (!await this.validator.validate()) {
            return;
        }
        const p: PatchableArrayAutoEncoder<WebshopDeliveryRegion> = new PatchableArray()
        p.addPatch(this.patchRegion)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je dit leveringsgebied wilt verwijderen?", "Verwijderen")) {
            return
        }
        const p: PatchableArrayAutoEncoder<WebshopDeliveryRegion> = new PatchableArray()
        p.addDelete(this.region.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchRegion, this.region, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
