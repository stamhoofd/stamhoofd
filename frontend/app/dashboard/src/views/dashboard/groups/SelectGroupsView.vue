<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar title="Kies inschrijvingsgroepen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon gray close" @click="pop" />
        </STNavigationBar>
        
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
                    </STListItem>
                </STList>
            </div>
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, EmailInput, ErrorBox, LoadingButton, PhoneInput, Radio, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { Group } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        Radio,
        PhoneInput,
        EmailInput,
        Checkbox,
        STList,
        STListItem,
        BackButton,
        LoadingButton
    }
})
export default class SelectGroupsView extends Mixins(NavigationMixin) {

    @Prop({ required: true })
    initialGroupIds!: string[]

    groupIds = this.initialGroupIds.slice()

    @Prop({ required: true })
    callback: (groupIds: string[]) => Promise<void>

    errorBox: ErrorBox | null = null
    loading = false
    validator = new Validator()

    get categoryTree() {
        return OrganizationManager.organization.getCategoryTreeWithDepth(1).filterForDisplay(true, true)
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
}
</script>