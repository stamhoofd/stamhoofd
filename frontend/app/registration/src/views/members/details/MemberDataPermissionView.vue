<template>
    <SaveView :title="title" :loading="loading" save-text="Doorgaan" @save="goNext">
        <h1>{{ title }}</h1>
        <p class="style-description pre-wrap" v-text="description" />

        <STErrorsDefault :error-box="errorBox" />

        <Checkbox v-model="dataPermission">
            {{ checkboxLabel }}
        </Checkbox>
    </SaveView>
</template>
<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ErrorBox, SaveView, STErrorsDefault, Validator } from "@stamhoofd/components";
import { BooleanStatus, DataPermissionsSettings, MemberDetails } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        SaveView,
        STErrorsDefault,
        Checkbox
    }
})
export default class MemberDataPermissionView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
    isNew: boolean

    @Prop({ required: true })
    details!: MemberDetails

    @Prop({ required: true })
    originalDetails: MemberDetails

    @Prop({ required: true })
    saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    validator = new Validator()
    errorBox: ErrorBox | null = null

    dataPermission = this.details.dataPermissions?.value ?? false

    async goNext() {
        if (this.loading) {
            return;
        }

        this.loading = true
        this.errorBox = null

        try {
            this.details.dataPermissions = BooleanStatus.create({
                value: this.dataPermission
            })
            await this.saveHandler(this.details, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    get title() {
        return this.settings.title || DataPermissionsSettings.defaultTitle
    }

    get description() {
        return this.settings.description || DataPermissionsSettings.defaultDescription
    }

    get checkboxLabel() {
        return this.settings.checkboxLabel || DataPermissionsSettings.defaultCheckboxLabel
    }

    get settings(): DataPermissionsSettings {
        return OrganizationManager.organization.meta.recordsConfiguration.dataPermission ?? DataPermissionsSettings.create({})
    }
}
</script>
