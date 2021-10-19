<template>
    <div id="financial-support-view" class="st-view">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>{{ title }}</h1>
            <p class="style-description pre-wrap" v-text="description" />

            <STErrorsDefault :error-box="errorBox" />

            <Checkbox v-model="dataPermission">
                {{ checkboxLabel }}
            </Checkbox>
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" @click="goNext">
                    <span>Doorgaan</span>
                    <span class="icon arrow-right" />
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>
<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton,BirthDayInput, Checkbox, EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { BooleanStatus, DataPermissionsSettings } from "@stamhoofd/structures"
import { MemberDetails } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        Slider,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        BirthDayInput,
        RadioGroup,
        Radio,
        PhoneInput,
        EmailInput,
        Checkbox,
        LoadingButton,
        BackButton
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
