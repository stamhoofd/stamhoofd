<template>
    <main class="webshop-view-details">
        <STErrorsDefault :error-box="errorBox" />
        <STInputBox title="Naam (kort)" error-fields="meta.name" :error-box="errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="bv. eetfestijn"
                autocomplete=""
            >
        </STInputBox>

        <hr>
        <h2>Afhalen</h2>

        <STList>
            <STListItem v-for="takeoutLocation in webshop.meta.takeoutLocations" :key="takeoutLocation.id" :selectable="true" @click="editTakeoutLocation(takeoutLocation)">
                {{ takeoutLocation.name }}

                <template slot="right">
                    <button class="button icon arrow-up gray" @click.stop="moveTakeoutUp(takeoutLocation)"/>
                    <button class="button icon arrow-down gray" @click.stop="moveTakeoutDown(takeoutLocation)"/>
                    <span  class="icon arrow-right-small gray"/>
                </template>
            </STListItem>
        </STList>

         <p>
            <button class="button text" @click="addTakeoutLocation">
                <span class="icon add"/>
                <span>Afhaallocatie toevoegen</span>
            </button>
        </p>

        <hr>
        <h2>Levering</h2>

        <p>
            <button class="button text" @click="addTakeoutLocation">
                <span class="icon add"/>
                <span>Leveringsoptie toevoegen</span>
            </button>
        </p>

       
    </main>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STListItem,TooltipDirective as Tooltip, STInputBox, STErrorsDefault, Validator } from "@stamhoofd/components";
import { EmergencyContact,MemberWithRegistrations, Parent, ParentTypeHelper, PrivateWebshop, Record, RecordTypeHelper, RecordTypePriority, Webshop, WebshopMetaData, WebshopTakeoutLocation } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import EditMemberEmergencyContactView from './edit/EditMemberEmergencyContactView.vue';
import EditMemberGroupView from './edit/EditMemberGroupView.vue';
import EditMemberParentView from './edit/EditMemberParentView.vue';
import EditMemberView from './edit/EditMemberView.vue';
import MemberView from './MemberView.vue';
import EditTakeoutLocationView from './locations/EditTakeoutLocationView.vue';
import RecordDescriptionView from './records/RecordDescriptionView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault
    },
    directives: { Tooltip },
})
export default class EditWebshopGeneralView extends Mixins(NavigationMixin) {
    @Prop()
    webshop!: PrivateWebshop;

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get name() {
        return this.webshop.meta.name
    }

    set name(name: string) {
        const patch = WebshopMetaData.patch({ name })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
    }

    addTakeoutLocation() {
        const takeoutLocation = WebshopTakeoutLocation.create({
            address: OrganizationManager.organization.address
        })
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.takeoutLocations.addPut(takeoutLocation)
        p.meta = meta

        this.present(new ComponentWithProperties(EditTakeoutLocationView, { takeoutLocation, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.$emit("patch", p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    editTakeoutLocation(takeoutLocation: WebshopTakeoutLocation) {
        this.present(new ComponentWithProperties(EditTakeoutLocationView, { takeoutLocation, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.$emit("patch", patch)
        }}).setDisplayStyle("popup"))
    }

    moveTakeoutUp(location: WebshopTakeoutLocation) {
        const index = this.webshop.meta.takeoutLocations.findIndex(c => location.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.takeoutLocations.addMove(location.id, this.webshop.meta.takeoutLocations[moveTo]?.id ?? null)
        p.meta = meta
        this.$emit("patch", p)
    }

    moveTakeoutDown(location: WebshopTakeoutLocation) {
        const index = this.webshop.meta.takeoutLocations.findIndex(c => location.id === c.id)
        if (index == -1 || index >= this.webshop.meta.takeoutLocations.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.takeoutLocations.addMove(location.id,this.webshop.meta.takeoutLocations[moveTo].id)
        p.meta = meta
        this.$emit("patch", p)
    }

  
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
