<template>
    <div class="st-view">
        <STNavigationBar :title="member.name">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        
        <main>
            <h1>Waarvoor wil je {{ member.firstName }} inschrijven?</h1>

            <p v-if="!member.details.age" class="warning-box">
                Vul de gegevens van {{ member.firstName }} aan om de mogelijke groepen automatisch te filteren.
            </p>

            <STList>
                <MemberBox v-for="group in groups" :key="group.id" :group="group" :member="member" type="group" />
            </STList>

            <p v-if="groups.length == 0" class="error-box">
                {{ member.firstName }} kan je op dit moment niet meer inschrijven. Dit kan het geval zijn als: de inschrijvingen gesloten zijn, als dit lid in geen enkele groep 'past' (bv. leeftijd) of als dit lid al is ingeschreven.
            </p>
        </main>

        <STToolbar v-if="hasItems">
            <button slot="right" class="primary button" @click="goToBasket">
                <span>Doorgaan</span>
                <span class="icon arrow-right" />
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { OrganizationManager } from "../../classes/OrganizationManager";
import MemberBox from "../../components/MemberBox.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        MemberBox
    }
})
export default class MemberChooseGroupsView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    member!: MemberWithRegistrations

    CheckoutManager = CheckoutManager

    get tree() {
        const tree = OrganizationManager.organization.getCategoryTreeWithDepth(1)
        // Filter the tree

        tree.groups = tree.groups.filter(g => this.member.shouldShowGroup(g, OrganizationManager.organization.meta.categories))
        for (const cat of tree.categories) {
            cat.groups = cat.groups.filter(g => this.member.shouldShowGroup(g, OrganizationManager.organization.meta.categories))
        }
        tree.categories = tree.categories.filter(c => c.groups.length > 0)

        return tree
    }

    get hasItems() {
        return !!CheckoutManager.cart.items.find(i => i.member.id === this.member.id)
    }

    get groups() {
        return [...this.tree.groups, ...this.tree.categories.flatMap(c => c.groups)]
    }

    goToBasket() {
        if (this.canDismiss) {
            this.dismiss({ force: true })
        } else {
            this.navigationController?.popToRoot({ force: true })
        }
        if (CheckoutManager.cart.items.find(i => i.member.id === this.member.id)) {
            new Toast("Ga door naar het mandje om de inschrijvingen te bevestigen", "basket green").setHide(3000).show()
        }
        
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>