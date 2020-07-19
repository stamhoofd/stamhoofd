<template>
    <div class="boxed-view">
        <div class="st-view auto">
            <main>
                <h1>De kostprijs van scouting</h1>

                <p>We doen ons best om de kostprijs van scouting zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om. Dit is enkel zichtbaar voor de takleiding. </p>

                <Checkbox>Mijn gezin heeft nood aan financieële ondersteuning en ik wil dit discreet kenbaar maken aan de leiding.</Checkbox>
            </main>

            <STToolbar>
                <button slot="right" class="button primary" @click="goNext">
                    <span>Volgende</span>
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
import { DecryptedMember, Group } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import TransferPaymentView from './TransferPaymentView.vue';

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
export default class FinancialProblemsView extends Mixins(NavigationMixin){
    MemberManager = MemberManager

    @Prop({ required: true })
    selectedMembers: DecryptedMember[]

    goNext() {
       
        this.show(new ComponentWithProperties(TransferPaymentView, {

        }))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>