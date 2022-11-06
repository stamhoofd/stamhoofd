<template>
    <div class="st-view">
        <STNavigationBar :title="member.name" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>Waarvoor wil je {{ member.firstName }} inschrijven?</h1>

            <div v-for="category of categories" :key="category.id" class="container">
                <hr>
                <h2>
                    {{ category.settings.name }}
                    <span v-if="!category.settings.public" v-tooltip="'Deze categorie is niet zichtbaar voor gewone leden'" class="icon lock" />
                </h2>
                <STList class="illustration-list">
                    <MemberBox v-for="group in category.groups" :key="group.id" :group="group" :member="member" type="group" />
                </STList>
            </div>

            <p v-if="categories.length == 0" class="error-box">
                {{ member.firstName }} kan je op dit moment niet meer inschrijven. Dit kan het geval zijn als: de inschrijvingen gesloten zijn, als dit lid in geen enkele groep 'past' (bv. leeftijd) of als dit lid al is ingeschreven.
            </p>

            <hr v-if="hasMore">
            <button v-if="hasMore" class="button text" type="button" @click="showAll">
                Toon alles
            </button>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from "../../classes/MemberManager";
import { OrganizationManager } from "../../classes/OrganizationManager";
import MemberBox from "../../components/MemberBox.vue";
import GroupsView from "./GroupsView.vue";

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
    MemberManager = MemberManager

    get tree() {
        return OrganizationManager.organization.getCategoryTree({
            maxDepth: 1, 
            admin: !!SessionManager.currentSession!.user!.permissions, 
            smartCombine: true, // don't concat group names with multiple levels if all categories only contain one group
            filterGroups: g => {
                const canRegister = this.member.canRegister(g, MemberManager.members ?? [], OrganizationManager.organization.meta.categories, CheckoutManager.cart.items);
                return !canRegister.closed || canRegister.waitingList
            }
        })
    }

    get categories() {
        return this.tree.categories
    }

    get hasMore() {
        return this.tree.getAllGroups().length !== OrganizationManager.organization.getGroupsForPermissions(SessionManager.currentSession?.user?.permissions).length
    }

    showAll() {
        this.present({
            components: [
                new ComponentWithProperties(
                    NavigationController, {
                        root: new ComponentWithProperties(
                            GroupsView, {
                                member: this.member
                            }
                        )
                    }
                )
            ],
            modalDisplayStyle: "popup"
        })
    }
}
</script>