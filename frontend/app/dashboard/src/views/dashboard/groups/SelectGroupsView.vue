<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar title="Kies inschrijvingsgroepen" :dismiss="canDismiss" :pop="canPop" />
        
        <main>
            <h1>
                Kies één of meerdere inschrijvingsgroepen
            </h1>

            <STErrorsDefault :error-box="errorBox" />
            
            <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.settings.name }}</h2>
                <STList>
                    <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <Checkbox slot="left" :checked="getSelectedGroup(group)" @change="setSelectedGroup(group, $event)" />
                        <h2 class="style-title-list">
                            {{ group.settings.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ group.getTimeRangeOffset(cycleOffset) }}
                        </p>
                    </STListItem>
                </STList>
            </div>

            <template v-if="allowArchived">
                <Spinner v-if="loadingGroups" />
                <template v-else-if="archivedGroups.length">
                    <hr>
                    <h2>Archief</h2>

                    <STList>
                        <STListItem v-for="group in archivedGroups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                            <Checkbox slot="left" :checked="getSelectedGroup(group)" @change="setSelectedGroup(group, $event)" />
                            <h2 class="style-title-list">
                                {{ group.settings.name }}
                            </h2>
                            <p class="style-description-small">
                                {{ group.getTimeRangeOffset(cycleOffset) }}
                            </p>
                        </STListItem>
                    </STList>
                </template>
            </template>

            <p v-if="categoryTree.categories.length === 0 && archivedGroups.length === 0 && !loadingGroups" class="info-box">
                Geen inschrijvingsgroepen beschikbaar om te selecteren.
            </p>
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="save">
                    Opslaan
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { Group } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        Spinner,
        Checkbox,
        STList,
        STListItem,
        LoadingButton
    }
})
export default class SelectGroupsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        initialGroupIds!: string[]

    @Prop({ default: true })
        allowArchived!: boolean

    @Prop({ default: 0 })
        cycleOffset!: number

    groupIds = this.initialGroupIds.slice()

    @Prop({ required: true })
        callback: (groupIds: string[]) => Promise<void>

    errorBox: ErrorBox | null = null
    loading = false
    validator = new Validator()

    archivedGroups: Group[] = []
    loadingGroups = true

    get categoryTree() {
        return OrganizationManager.organization.getCategoryTree({maxDepth: 1, admin: true, smartCombine: true, filterGroups: this.filterGroup})
    }

    filterGroup(group: Group) {
        return group.cycle >= this.cycleOffset
    }

    mounted() {
        this.load().catch(console.error)
    }

    getSelectedGroup(group: Group): boolean {
        return this.groupIds.includes(group.id)
    }

    setSelectedGroup(group: Group, selected: boolean) {
        if (selected) {
            if (this.getSelectedGroup(group) === selected) {
                return
            }
            this.groupIds.push(group.id)
        } else {
            const index = this.groupIds.findIndex(id => id === group.id)
            if (index !== -1) {
                this.groupIds.splice(index, 1)
            }
        }
    }

    async save() {
        if (this.loading) {
            return;
        }
        this.loading = true
        
        try {
            await this.callback(this.groupIds)
            this.errorBox = null
            this.loading = false;
            this.dismiss({ force: true })
            return true
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            this.loading = false;
            return false;
        }
    }

    async shouldNavigateAway() {
        if (this.groupIds.join(",") == this.initialGroupIds.join(",")) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    async load() {
        if (!this.allowArchived) {
            this.loadingGroups = false
            return;
        }

        try {
            this.archivedGroups = (await OrganizationManager.loadArchivedGroups({owner: this})).filter(this.filterGroup)
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.loadingGroups = false
    }

    beforeDestroy() {
        // Cancel all requests
        Request.cancelAll(this)
    }

}
</script>