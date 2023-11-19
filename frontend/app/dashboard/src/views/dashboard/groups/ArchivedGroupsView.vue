<template>
    <div class="st-view">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                {{ title }}
            </h1>
                
            <p>
                Deze inschrijvingsgroepen werden gearchiveerd. Je kan ze altijd nog bekijken en hun gegevens blijven behouden tot je ze manueel verwijdert. Hier kan je dus afgelopen activiteiten in bewaren.
            </p>

            <Spinner v-if="loadingGroups" />
            <STList v-else-if="groups.length">
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                    <GroupAvatar slot="left" :group="group" />
                    
                    <h2 class="style-title-list">
                        {{ group.settings.name }}
                    </h2>
                    <p class="style-description-small">
                        {{ group.settings.dateRangeDescription }}
                    </p>

                    <template slot="right">
                        <span v-if="group.settings.registeredMembers !== null" class="style-description-small">{{ group.settings.registeredMembers }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                Het archief is leeg.
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, GroupAvatar, Spinner,STList, STListItem, STNavigationBar, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { Group, GroupCategory, GroupCategoryTree, Organization, OrganizationMetaData } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import GroupOverview from "./GroupOverview.vue";

@Component({
    components: {
        STNavigationBar,
        STList,
        GroupAvatar,
        STListItem,
        Spinner
    },
})
export default class ArchivedGroupsView extends Mixins(NavigationMixin) {
    loadingGroups = true
    groups: Group[] = []

    get title() {
        return "Leden archief"
    }

    mounted() {
        // Set url
        UrlHelper.setUrl("/archived-groups")
        document.title = "Stamhoofd - Archief"

        // Load deleted groups
        this.load().catch(console.error)
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date)
    }

    async load() {
        try {
            this.groups = await OrganizationManager.loadArchivedGroups({owner: this})
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.loadingGroups = false
    }

    beforeDestroy() {
        // Cancel all requests
        Request.cancelAll(this)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get allCategories() {
        return this.organization.getCategoryTree({admin: true, permissions: OrganizationManager.user?.permissions}).getAllCategories().filter(c => c.categories.length == 0)
    }

    openGroup(group: Group) {
        this.show({
            components: [
                new ComponentWithProperties(GroupOverview, {
                    group
                })
            ]
        })
    }

    async restoreGroup(event, group: Group) {
        if (this.allCategories.length == 1) {
            await this.restoreTo(group, this.allCategories[0])
            return
        }

        const menu = new ContextMenu([
            this.allCategories.map(cat => 
                new ContextMenuItem({
                    name: cat.settings.name,
                    rightText: cat.groupIds.length+"",
                    action: () => {
                        this.restoreTo(group, cat).catch(console.error)
                        return true
                    }
                })
            )
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }

    async restoreTo(group: Group, cat: GroupCategoryTree) {
        if (!(await CenteredMessage.confirm(`${group.settings.name} terugzetten naar ${cat.settings.name}?`, 'Ja, terugzetten'))) {
            return
        }

        const metaPatch = OrganizationMetaData.patch({})
        const catPatch = GroupCategory.patch({id: cat.id})
        catPatch.groupIds.addPut(group.id)

        metaPatch.categories.addPatch(catPatch)

        const patch = Organization.patch({
            id: this.organization.id,
            meta: metaPatch
        })

        patch.groups.addPatch(Group.patch({
            id: group.id,
            deletedAt: null
        }))

        try {
            await OrganizationManager.patch(patch)
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.load().catch(console.error);
    }
}
</script>
