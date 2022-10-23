<template>
    <div class="st-view">
        <STNavigationBar :title="text">
            <button v-if="canDismiss" slot="right" class="button icon close gray" type="button" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>{{ text }}</h1>
            
            <p>
                Je ontvangt een extra bevestiging via e-mail. Als er in de toekomst gegevens wijzigen kan je die vanaf nu beheren via het ledenportaal.
            </p>
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="close">
                    <span>Sluiten</span>
                    <span class="icon arrow-right" />
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, GlobalEventBus, LoadingButton,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { RegistrationWithMember } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins,  Prop } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from '../../classes/MemberManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        LoadingButton
    }
})
export default class RegistrationSuccessView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    registrations: RegistrationWithMember[]

    MemberManager = MemberManager
    step = 4
    isStepsPoppable = false
    loading = false

    get text() {
        let t = "Hoera! "
        const names = this.names

        if (names.length > 0) {
            if (names.length > 2) {
                t += names.slice(0, names.length - 1).join(', ')+" en "+names[names.length - 1] +" zijn ingeschreven"
            } else if (names.length > 1) {
                t += names.join(' en ')+" zijn ingeschreven"
            } else {
                t += names.join('')+" is ingeschreven"
            }
        }

        const waitingListNames = this.waitingListNames

        if (waitingListNames.length > 0) {
            if (names.length > 0) {
                t += " en "
            }

            if (waitingListNames.length > 2) {
                t += waitingListNames.slice(0, waitingListNames.length - 1).join(', ')+" en "+waitingListNames[waitingListNames.length - 1] +" staan op de wachtlijst"
            } else if (waitingListNames.length > 1) {
                t += waitingListNames.join(' en ')+" staan op de wachtlijst"
            } else {
                t += waitingListNames.join('')+" staat op de wachtlijst"
            }
        }
        return t
    }

    get names() {
        return Formatter.uniqueArray(this.registrations.filter(r => !r.waitingList).map(r => r.member.details?.firstName ?? "?"))
    }

    get waitingListNames() {
        return Formatter.uniqueArray(this.registrations.filter(r => r.waitingList).map(r => r.member.details?.firstName ?? "?"))
    }

    mounted() {
        // Clear cart
        CheckoutManager.cart.clear()
        CheckoutManager.saveCart()

        // Clear balance (probably changed)
        CheckoutManager.fetchBalance().catch(console.error)

        // Switch to register tab
        GlobalEventBus.sendEvent("checkout-complete", undefined).catch(e => console.error(e))
    }

    async close() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        await MemberManager.loadMembers()
        this.dismiss({ force: true })
        this.loading = false;
    }

}
</script>

