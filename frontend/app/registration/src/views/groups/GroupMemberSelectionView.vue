<template>
    <div class="st-view group-view">
        <STNavigationBar title="Inschrijven">
            <template slot="left">
                <BackButton v-if="canPop" @click="pop" />
                <button v-else slot="right" class="button icon gray close" @click="pop" />
            </template>
        </STNavigationBar>
        
        <main>
            <h1>Wie wil je inschrijven voor "{{ group.settings.name }}"?</h1>

            <p v-if="members.length === 0" class="info-box">
                Je hebt nog geen leden aan jouw account toegevoegd. Voeg eerst een lid toe voor je ergens inschrijft.
            </p>
            <p v-else-if="!canRegister" class="info-box">
                Geen leden uit jouw account kunnen hiervoor inschrijven (zie onder). Voeg eventueel een nieuw lid toe.
            </p>

            <STList>
                <MemberBox v-for="member in members" :key="member.id" :group="group" :member="member" />
            </STList>
        </main>

        <STToolbar>
            <button slot="right" class="secundary button" @click="addNewMember">
                <span class="icon add" />
                <span>Nieuw lid toevoegen</span>
            </button>
            <button v-if="hasItems" slot="right" class="primary button" @click="goToBasket">
                <span>Doorgaan</span>
                <span class="icon arrow-right" />
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from "../../classes/MemberManager";
import { OrganizationManager } from "../../classes/OrganizationManager";
import MemberBox from "../../components/MemberBox.vue"
import { EditMemberStepsManager, EditMemberStepType } from "../members/details/EditMemberStepsManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        MemberBox
    },
    filters: {
        price: Formatter.price
    }
})
export default class GroupMemberSelectionView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    group!: Group

    MemberManager = MemberManager
    CheckoutManager = CheckoutManager

    get members() {
        return this.MemberManager.members ?? []
    }

    get closed() {
        return this.group.closed
    }

    get canRegister() {
        return !!this.members.find(m => !m.canRegister(this.group, MemberManager.members ?? [], OrganizationManager.organization.meta.categories, CheckoutManager.cart.items).closed)
    }

    get hasItems() {
        return !!CheckoutManager.cart.items.find(i => i.group.id === this.group.id)
    }

    goToBasket() {
        this.dismiss({ force: true })

        if (CheckoutManager.cart.items.find(i => i.group.id === this.group.id)) {
            new Toast("Ga door naar het mandje om de inschrijvingen te bevestigen", "basket green").setHide(3000).show()
        }
    }

    async addNewMember() {
        // Only ask details + parents for new members
        // We'll ask the other things when selecting the details
        const stepManager = new EditMemberStepsManager(
            [
                EditMemberStepType.Details,
                EditMemberStepType.Parents
            ], 
            undefined,
            (component: NavigationMixin) => {
                // when we are ready, return to this component
                component.dismiss({ force: true })
                return Promise.resolve()
            }
        )
        const component = await stepManager.getFirstComponent()
        this.present(new ComponentWithProperties(NavigationController, {
            root: component
        }).setDisplayStyle("popup"))
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-view {
}
</style>