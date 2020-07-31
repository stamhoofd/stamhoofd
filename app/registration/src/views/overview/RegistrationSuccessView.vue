<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1 v-if="names.length == 2">Hoera! {{ names.join(' en ') }} zijn ingeschreven</h1>
                <h1 v-else-if="names.length > 1">Hoera! {{ names.slice(0, names.length - 1).join(', ') }} en {{ names[names.length - 1] }} zijn ingeschreven</h1>
                <h1 v-else>Hoera! {{ names[0] }} is ingeschreven</h1>
                <p>Je kan hier later super gemakkelijk jaarlijks de inschrijving verlengen. Hou wel zeker je wachtwoord goed bij (bij voorkeur met een wachtwoordbeheerder als je het niet gaat onthouden). Omdat we met end-to-end encryptie werken is het herstellen van een vergeten wachtwoord iets meer werk dan je gewoon bent.</p>
            </main>

            <STToolbar>
                <button slot="right" class="button primary" @click="close">
                    <span>Sluiten</span>
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
import { MemberWithRegistrations, Group, PaymentDetailed } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import OverviewView from './OverviewView.vue';

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
export default class RegistrationSuccessView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    payment: PaymentDetailed

    MemberManager = MemberManager
    step = 4

    mounted() {
        console.log(this.payment)
        MemberManager.loadMembers().catch(e => {
            console.error(e)
        })
    }

    get names() {
        return this.payment.registrations.map(r => r.member.details?.firstName ?? "")
    }

    close() {
        this.navigationController!.push(new ComponentWithProperties(OverviewView, {}), true, this.navigationController!.components.length, true)
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>