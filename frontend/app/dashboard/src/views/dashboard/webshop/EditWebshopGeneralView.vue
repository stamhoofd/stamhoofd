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
        <h2>Afhaal- en leveringsopties</h2>

        <STList>
            <STListItem v-for="method in webshop.meta.checkoutMethods" :key="method.id" :selectable="true" @click="editCheckoutMethod(method)">
                {{ method.type }}: {{ method.name }}

                <template slot="right">
                    <button class="button icon arrow-up gray" @click.stop="moveCheckoutUp(method)" />
                    <button class="button icon arrow-down gray" @click.stop="moveCheckoutDown(method)" />
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" @click="addTakeoutMethod">
                <span class="icon add" />
                <span>Afhaallocatie toevoegen</span>
            </button>
        </p>

        <p>
            <button class="button text" @click="addDeliveryMethod">
                <span class="icon add" />
                <span>Leveringsoptie toevoegen</span>
            </button>
        </p>
        
    </main>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STInputBox, STList, STListItem,TooltipDirective as Tooltip, Validator } from "@stamhoofd/components";
import { AnyCheckoutMethod, CheckoutMethod, EmergencyContact,MemberWithRegistrations, Parent, ParentTypeHelper, PrivateWebshop, Record, RecordTypeHelper, RecordTypePriority, Webshop, WebshopDeliveryMethod, WebshopMetaData, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import EditMemberEmergencyContactView from './edit/EditMemberEmergencyContactView.vue';
import EditMemberGroupView from './edit/EditMemberGroupView.vue';
import EditMemberParentView from './edit/EditMemberParentView.vue';
import EditMemberView from './edit/EditMemberView.vue';
import EditDeliveryMethodView from './locations/EditDeliveryMethodView.vue';
import EditTakeoutMethodView from './locations/EditTakeoutMethodView.vue';
import MemberView from './MemberView.vue';
import RecordDescriptionView from './records/RecordDescriptionView.vue';

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

    addTakeoutMethod() {
        const takeoutMethod = WebshopTakeoutMethod.create({
            address: OrganizationManager.organization.address
        })
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(takeoutMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditTakeoutMethodView, { takeoutMethod, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.$emit("patch", p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    addDeliveryMethod() {
        const deliveryMethod = WebshopDeliveryMethod.create({})
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(deliveryMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditDeliveryMethodView, { deliveryMethod, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.$emit("patch", p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    editCheckoutMethod(checkoutMethod: AnyCheckoutMethod) {
        if (checkoutMethod instanceof WebshopTakeoutMethod) {
            this.present(new ComponentWithProperties(EditTakeoutMethodView, { takeoutMethod: checkoutMethod, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.$emit("patch", patch)
            }}).setDisplayStyle("popup"))
        } else {
            this.present(new ComponentWithProperties(EditDeliveryMethodView, { deliveryMethod: checkoutMethod, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.$emit("patch", patch)
            }}).setDisplayStyle("popup"))
        }
    }

    moveCheckoutUp(location: CheckoutMethod) {
        const index = this.webshop.meta.checkoutMethods.findIndex(c => location.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addMove(location.id, this.webshop.meta.checkoutMethods[moveTo]?.id ?? null)
        p.meta = meta
        this.$emit("patch", p)
    }

    moveCheckoutDown(location: CheckoutMethod) {
        const index = this.webshop.meta.checkoutMethods.findIndex(c => location.id === c.id)
        if (index == -1 || index >= this.webshop.meta.checkoutMethods.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addMove(location.id,this.webshop.meta.checkoutMethods[moveTo].id)
        p.meta = meta
        this.$emit("patch", p)
    }

  
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
