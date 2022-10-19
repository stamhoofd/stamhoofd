<template>
    <div class="st-view background">
        <STNavigationBar title="Alles" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>Alles</h1>

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
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, OrganizationLogo, STList, STListItem, STNavigationBar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { MemberWithRegistrations } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from "../../classes/MemberManager";
import { OrganizationManager } from "../../classes/OrganizationManager";
import MemberBox from "../../components/MemberBox.vue";

@Component({
    components: {
        STNavigationBar,
        OrganizationLogo,
        STList,
        STListItem,
        BackButton,
        MemberBox
    }
})
export default class GroupsView extends Mixins(NavigationMixin){
    MemberManager = MemberManager

    @Prop({ required: false })
    member!: MemberWithRegistrations

    get organization() {
        return OrganizationManager.organization
    }

    get fullTree() {
        return OrganizationManager.organization.getCategoryTree({maxDepth: 1, permissions: SessionManager.currentSession!.user!.permissions})
    }

    get categories() {
        return this.fullTree.categories
    }
}
</script>