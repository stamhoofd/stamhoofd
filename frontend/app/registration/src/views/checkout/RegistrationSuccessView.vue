<template>
    <div class="st-view">
        <STNavigationBar :title="text">
            <template v-if="canDismiss" #right><button class="button icon close gray" type="button" @click="dismiss" /></template>
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
import { Checkbox, GlobalEventBus, LoadingButton, LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { RegistrationWithMember } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


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
        this.$checkoutManager.cart.clear()
        this.$checkoutManager.saveCart()

        // Clear balance (probably changed)
        this.$checkoutManager.fetchBalance().catch(console.error)

        // Switch to register tab
        GlobalEventBus.sendEvent("checkout-complete", undefined).catch(e => console.error(e))

        this.$memberManager.loadMembers().catch(console.error)
        this.$memberManager.loadDocuments().catch(console.error)
    }

    close() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.dismiss({ force: true })
        this.loading = false;
    }

}
</script>

