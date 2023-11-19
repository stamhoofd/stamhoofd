<template>
    <div class="st-view">
        <STNavigationBar :title="member.name" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>Waarvoor wil je {{ member.firstName }} inschrijven?</h1>

            <p v-if="categories.length == 0" class="error-box">
                {{ member.firstName }} kan je op dit moment niet meer inschrijven. Dit kan het geval zijn als: de inschrijvingen gesloten zijn, als dit lid in geen enkele groep 'past' (bv. leeftijd) of als dit lid al is ingeschreven.
            </p>

            <div v-if="categories.length == 0 && member.activeRegistrations.length > 0" class="container member-view-details">
                <hr>
                <h2>
                    Al ingeschreven voor
                </h2>

                <STList>
                    <STListItem v-for="registration in member.activeRegistrations" :key="registration.id" class="left-center">
                        <figure v-if="imageSrc(registration)" slot="left" class="registration-image">
                            <img :src="imageSrc(registration)">
                            <div>
                                <span v-if="!registration.waitingList" class="icon green success" />
                                <span v-else class="icon gray clock" />
                            </div>
                        </figure>
                        <figure v-else slot="left" class="registration-image">
                            <figure>
                                <span>{{ getGroup(registration.groupId).settings.getShortCode(2) }}</span>
                            </figure>
                            <div>
                                <span v-if="!registration.waitingList" class="icon green success" />
                                <span v-else class="icon gray clock" />
                            </div>
                        </figure>
                        <h3 class="style-title-list">
                            {{ getGroup(registration.groupId).settings.name }}
                        </h3>
                        <p v-if="!registration.waitingList" class="style-description-small">
                            Ingeschreven op {{ registration.registeredAt | dateTime }}
                        </p>
                        <p v-else class="style-description-small">
                            Op wachtlijst sinds {{ registration.createdAt | dateTime }}
                        </p>
                    </STListItem>
                </STList>
            </div>

            <div v-for="category of visibleCategories" :key="category.id" class="container">
                <hr>
                <h2>
                    {{ category.settings.name }}
                    <span v-if="!category.settings.public" v-tooltip="'Deze categorie is niet zichtbaar voor gewone leden'" class="icon lock" />
                </h2>
                <STList class="illustration-list">
                    <MemberBox v-for="group in category.groups" :key="group.id" :group="group" :member="member" type="group" />
                </STList>
            </div>

            <hr v-if="hasMore">
            <button v-if="hasMore" class="button text" type="button" @click="showAll">
                <span class="icon ul" />
                <span>Toon alles</span>
            </button>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { MemberWithRegistrations, Registration } from '@stamhoofd/structures';
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
    showMore = false

    mounted() {
        if (this.categories.length === 0) {
            this.showMore = true
        }
    }

    getGroup(groupId: string) {
        return OrganizationManager.organization.groups.find(g => g.id === groupId)
    }

    imageSrc(registration: Registration) {
        const group = this.getGroup(registration.groupId)
        if (!group) {
            return null
        }
        return (group.settings.squarePhoto ?? group.settings.coverPhoto)?.getPathForSize(100, 100)
    }

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

    get fullTree() {
        return OrganizationManager.organization.getCategoryTree({maxDepth: 1, admin: !!SessionManager.currentSession!.user!.permissions, smartCombine: true})
    }

    get categories() {
        return this.tree.categories
    }

    get fullCategories() {
        return this.fullTree.categories
    }

    get visibleCategories() {
        if (this.showMore) {
            return this.fullCategories
        }
        return this.categories
    }

    get hasMore() {
        return !this.showMore && this.tree.getAllGroups().length !== OrganizationManager.organization.getGroupsForPermissions(SessionManager.currentSession?.user?.permissions).length
    }

    get hasLess() {
        return this.showMore && this.categories.length !== 0
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