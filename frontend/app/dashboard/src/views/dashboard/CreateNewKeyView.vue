<template>
    <div class="st-view background" id="no-key-view">
        <STNavigationBar title="Sleutel kwijt">
        </STNavigationBar>

        <main>
            <h1>
                Een nieuwe encryptie-sleutel maken
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <p class="style-description">Maak een nieuwe encryptie-sleutel aan. Jij en alle andere beheerders verliezen toegang tot de data. Je zal alle beheerders opnieuw een uitnodiging moeten versturen die ze moeten accepteren met hun bestaand account.</p>
            <p class="error-box">Doe dit enkel als er geen andere beheerders zijn die nog toegang hebben! Anders verlies je toegang tot alle gegevens.</p>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="dismiss">
                    Annuleren
                </button>
                <LoadingButton :loading="loading">
                    <button class="button destructive" @click="createKey">
                        Sleutel maken
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, BackButton, RadioGroup, Checkbox, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, EmailInput, Toast } from "@stamhoofd/components";
import { SessionManager, LoginHelper } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData, Image, ResolutionRequest, ResolutionFit, Version, User } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import ChangePasswordView from './ChangePasswordView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
        STErrorsDefault
    },
})
export default class CreateNewKeyView extends Mixins(NavigationMixin) {
    loading = false
    errorBox: ErrorBox | null = null

    async createKey() {
        if (this.loading) {
            return
        }
        this.loading = true
        this.errorBox = null

        try {
            await LoginHelper.changeOrganizationKey(SessionManager.currentSession!)
            window.location.reload()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            this.loading = false
        }
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

    
</style>