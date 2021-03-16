<template>
    <div class="st-view">
        <STNavigationBar :title="member.name">
            <template slot="left">
                <BackButton v-if="canPop" @click="pop" />
            </template>
        </STNavigationBar>
        
        <main>
            <h1>Waarvoor wil je {{ member.firstName }} inschrijven?</h1>

            <STList>
                <MemberBox v-for="group in groups" :key="group.id" :group="group" :member="member" type="group" />
            </STList>
        </main>

        <STToolbar>
            <button slot="right" class="primary button" @click="goToBasket">
                <span>Doorgaan</span>
                <span class="icon arrow-right" />
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

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


    get tree() {
        const tree = OrganizationManager.organization.getCategoryTreeWithDepth(1)
        // Filter the tree

        tree.groups = tree.groups.filter(g => this.member.doesMatchGroup(g, OrganizationManager.organization.meta.categories))
        for (const cat of tree.categories) {
            cat.groups = cat.groups.filter(g => this.member.doesMatchGroup(g, OrganizationManager.organization.meta.categories))
        }
        tree.categories = tree.categories.filter(c => c.groups.length > 0)

        return tree
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
        
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>