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

                    <template #right>
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
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { GroupAvatar, Spinner,STList, STListItem, STNavigationBar, Toast } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { Group } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";


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
            this.groups = await this.$organizationManager.loadArchivedGroups({owner: this})
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
        return this.$organization
    }

    get allCategories() {
        return this.organization.getCategoryTree({admin: true, permissions: this.$organizationManager.user?.permissions}).getAllCategories().filter(c => c.categories.length == 0)
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
}
</script>
