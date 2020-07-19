<template>
    <div class="boxed-view">
        <div class="st-view auto">
            <main>
                <h1>Lidgeld overschrijven</h1>
                <p>Voer de onderstaande overschrijving uit. Vermeld zeker de mededeling in je overschrijving! Je kan de QR-code scannen met de meeste bank apps.</p>

                <p class="warning-box">Vermeld zeker “{{ payment.transferDescription }}” in je overschrijving.</p>
            </main>

            <STToolbar>
                <button slot="right" class="button secundary">
                    Afdrukken
                </button>
                <button slot="right" class="button primary" @click="goNext">
                    <span>Ik heb overgeschreven</span>
                    <span class="icon arrow-right"/>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { DecryptedMember, Group, Payment } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import RegistrationSuccessView from './RegistrationSuccessView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    }
})
export default class TransferPaymentView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    payment: Payment

    MemberManager = MemberManager

    goNext() {
       
        this.show(new ComponentWithProperties(RegistrationSuccessView, {

        }))
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>