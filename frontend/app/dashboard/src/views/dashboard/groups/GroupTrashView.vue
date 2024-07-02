<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>
                
            <p>
                Deze inschrijvingsgroepen werden verwijderd. Je kan ze terugzetten door ze aan te klikken.
            </p>

            <Spinner v-if="loadingGroups" />
            <STList v-else-if="groups.length">
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="restoreGroup($event, group)">
                    <template #left>
                        <GroupAvatar #left :group="group" />
                    </template>
                    
                    <h2 class="style-title-list">
                        {{ group.settings.name }}
                    </h2>
                    <p class="style-description-small">
                        {{ group.settings.dateRangeDescription }}
                    </p>
                    <p class="style-description-small" v-if="group.deletedAt">
                        Verwijderd op {{ formatDate(group.deletedAt) }}
                    </p>

                    <template #right>
                        <span class="icon undo gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                De prullenmand is leeg.
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { CenteredMessage, ContextMenu, ContextMenuItem, GroupAvatar, STList, STListItem, STNavigationBar, Spinner, Toast } from "@stamhoofd/components";
import { Group, GroupCategory, GroupCategoryTree, Organization, OrganizationMetaData, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";


@Component({
    components: {
        STNavigationBar,
        STList,
        GroupAvatar,
        STListItem,
        Spinner
    },
})
export default class GroupTrashView extends Mixins(NavigationMixin) {
    loadingGroups = true
    groups: Group[] = []

    get title() {
        return "Prullenmand"
    }

    mounted() {
        // Load deleted groups
        this.load().catch(console.error)
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date)
    }

    async load() {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/organization/deleted-groups",
                decoder: new ArrayDecoder(Group as Decoder<Group>),
                owner: this
            })

            this.groups = response.data.filter(g => g.periodId === this.organization.period.period.id)
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.loadingGroups = false
    }

    beforeUnmount() {
        // Cancel all requests
        Request.cancelAll(this)
    }

    get organization() {
        return this.$organization
    }

    get allCategories() {
        return this.organization.getCategoryTree({
            admin: true, 
            permissions: this.$context.auth.permissions
        }).getAllCategories().filter(c => c.categories.length == 0)
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

        const settings = OrganizationRegistrationPeriodSettings.patch({})
        const catPatch = GroupCategory.patch({id: cat.id})
        
        if (cat.groupIds.filter(id => id == group.id).length > 1) {
            // Not fixable, we need to set the ids manually
            const cleaned = cat.groupIds.filter(id => id != group.id)
            cleaned.push(group.id)
            catPatch.groupIds = cleaned as any
        } else {
            // We need to delete it to fix issues if it is still there
            catPatch.groupIds.addDelete(group.id)
            catPatch.groupIds.addPut(group.id)
        }

        settings.categories.addPatch(catPatch)

        const patch = OrganizationRegistrationPeriod.patch({
            id: this.organization.period.id,
            settings
        })

        patch.groups.addPatch(Group.patch({
            id: group.id,
            deletedAt: null
        }))

        try {
            await this.$organizationManager.patchPeriod(patch)
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.load().catch(console.error);
    }
}
</script>
