<template>
    <SaveView id="personalize-settings-view" :loading="saving" :disabled="!hasChanges" :title="$t(`4a7e3838-f75a-4610-9caa-0f75849ea142`)" @save="save">
        <h1>
            {{ $t('f45871aa-7723-42c3-9781-f4f9b8d7250a') }}
        </h1>
        <p>{{ $t('ad37ed24-55c8-48a9-8c53-3c2fbba9e8c5') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogo" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :title="$t(`d318cac1-28c1-4a21-88a1-98ae60f7a619`)" />

                <p class="st-list-description">
                    {{ $t('20e536a4-be51-42f4-92ec-ce64b3af3c7f') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogo" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :title="$t(`af11402d-47f2-4dfc-a522-b29c37014738`)" />
                <p class="st-list-description">
                    {{ $t('9c6061e0-11f7-4f88-99c7-7a0bd6c5dea4') }}
                </p>
            </div>
        </div>

        <Checkbox v-model="expandLogo">
            {{ $t('9e68d551-a532-4681-9040-95e4c0f673aa') }}
        </Checkbox>
        <p class="st-list-description">
            {{ $t('6c68261d-e165-48c0-b93d-759fd08a8511') }}
        </p>

        <ColorInput v-model="color" :validator="validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`d111d211-9cc2-48be-9c8f-9483dded7fef`)" :placeholder="$t(`dc5f036d-4aac-4894-8d3f-70ae0874ebcc`)" />
        <p class="st-list-description">
            {{ $t('e1447811-99f2-4c3b-90c2-3ae2599d4454') }}
        </p>

        <div v-if="STAMHOOFD.userMode === 'organization'" class="container">
            <hr><h2>{{ $t('30e5c996-ef97-4ad6-8503-049163cd197d') }}</h2>

            <p>{{ $t('d6803bae-250a-40f6-950c-475e760c35bd') }} <a class="inline-link" :href="$domains.getDocs('domeinnaam-koppelen')" target="_blank">{{ $t('3280290b-f43e-4e95-a7bd-3c13a153888b') }}</a>.</p>

            <template v-if="organization.privateMeta && (organization.privateMeta.mailDomain || organization.privateMeta.pendingMailDomain || organization.privateMeta.pendingRegisterDomain || organization.registerDomain)">
                <p v-if="isMailOk" class="success-box">
                    {{ $t('b7985e12-33ca-4c18-9b56-0d57e39c6dfa') }} <template v-if="!organization.privateMeta.mailDomainActive">
                        {{ $t('93544666-3c0a-42b8-9ce3-ed4778735ded') }}
                    </template>
                </p>
                <p v-else class="warning-box">
                    {{ $t('94547449-549d-4572-b217-c1a089b12997') }}
                </p>

                <template v-if="enableMemberModule">
                    <p v-if="isRegisterOk" class="success-box">
                        {{ $t('e7f331ed-3ca4-4aa6-a67f-be63e598a013') }} {{ organization.registerDomain }})
                    </p>
                    <p v-else class="warning-box">
                        {{ $t("d9f5fd80-32b3-40d7-aaa6-3b65589299d6") }}
                    </p>
                </template>

                <p v-if="isMailOk && (isRegisterOk || !enableMemberModule)" class="st-list-description">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings" />
                        <span>{{ $t('b2248880-cba7-4115-912b-9cb981e3c2d1') }}</span>
                    </button>
                </p>

                <p v-else class="st-list-description">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings" />
                        <span>{{ $t('a6118aff-7bfe-4a5a-91d5-9c8fd09ae93d') }}</span>
                    </button>
                </p>
            </template>

            <template v-else>
                <p v-if="organization.registerUrl && enableMemberModule" class="st-list-description">
                    {{ $t('0388d1ce-079c-4609-b11e-78ba654029d6') }} <a class="button inline-link" :href="organization.registerUrl" target="_blank">{{ organization.registerUrl }}</a>. {{ $t('57e20ed4-d50a-4947-96fc-57958550dcfa') }}
                </p>
                <p v-else class="st-list-description">
                    {{ $t('8b32118a-658d-4e17-96f9-a009449ec342') }}
                </p>

                <p class="st-list-description">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings" />
                        <span>{{ $t('a6118aff-7bfe-4a5a-91d5-9c8fd09ae93d') }}</span>
                    </button>
                </p>
            </template>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ColorInput, ErrorBox, ImageInput, SaveView, STErrorsDefault, Toast, Validator } from '@stamhoofd/components';
import { Image, Organization, OrganizationMetaData, ResolutionFit, ResolutionRequest, Version } from '@stamhoofd/structures';

import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';

@Component({
    components: {
        SaveView,
        STErrorsDefault,
        Checkbox,
        ImageInput,
        ColorInput,
    },
    navigation: {
        title: 'Personaliseren',
    },
})
export default class PersonalizeSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;
    temp_organization = this.$organization;
    showDomainSettings = true;

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = Organization.patch({});

    created() {
        this.organizationPatch.id = this.$organization.id;
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch);
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers;
    }

    get squareLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 50,
                width: 50,
                fit: ResolutionFit.Inside,
            }),
            ResolutionRequest.create({
                height: 70,
                width: 70,
                fit: ResolutionFit.Inside,
            }),
            ResolutionRequest.create({
                height: 50 * 3,
                width: 50 * 3,
                fit: ResolutionFit.Inside,
            }),
            ResolutionRequest.create({
                height: 70 * 3,
                width: 70 * 3,
                fit: ResolutionFit.Inside,
            }),
            ResolutionRequest.create({
                height: 70 * 3,
                width: 70 * 3,
                fit: ResolutionFit.Inside,
            }),
        ];
    }

    get horizontalLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 50,
                width: 300,
                fit: ResolutionFit.Inside,
            }),
            ResolutionRequest.create({
                height: 70,
                width: 300,
                fit: ResolutionFit.Inside,
            }),
            ResolutionRequest.create({
                height: 50 * 3,
                width: 300 * 3,
                fit: ResolutionFit.Inside,
            }),
            ResolutionRequest.create({
                height: 70 * 3,
                width: 300 * 3,
                fit: ResolutionFit.Inside,
            }),
        ];
    }

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<Organization>>) {
        this.organizationPatch = this.organizationPatch.patch(Organization.patch(patch));
    }

    get color() {
        return this.organization.meta.color;
    }

    set color(color: string | null) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                color: color,
            }),
        });
    }

    get squareLogo() {
        return this.organization.meta.squareLogo;
    }

    set squareLogo(squareLogo: Image | null) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                squareLogo,
            }),
        });
    }

    get expandLogo() {
        return this.organization.meta.expandLogo;
    }

    set expandLogo(expandLogo: boolean) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                expandLogo,
            }),
        });
    }

    get horizontalLogo() {
        return this.organization.meta.horizontalLogo;
    }

    set horizontalLogo(horizontalLogo: Image | null) {
        this.addPatch({
            meta: OrganizationMetaData.patch({
                horizontalLogo,
            }),
        });
    }

    get isMailOk() {
        return this.organization.privateMeta?.pendingMailDomain === null && this.organization.privateMeta?.mailDomain !== null;
    }

    get isRegisterOk() {
        return this.organization.privateMeta?.pendingRegisterDomain === null && this.organization.registerDomain !== null;
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors();

        let valid = false;

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
            valid = true;
        }
        valid = valid && await this.validator.validate();

        if (!valid) {
            return;
        }

        this.saving = true;

        try {
            await this.$organizationManager.patch(this.organizationPatch);
            this.organizationPatch = Organization.patch({ id: this.$organization.id });
            new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
            this.dismiss({ force: true });
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }

        this.saving = false;
    }

    setupDomain() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(DomainSettingsView, {}),
        }).setDisplayStyle('popup'));
    }

    openRecords() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(DNSRecordsView, {}),
        }).setDisplayStyle('popup'));
    }

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, this.$organization, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#personalize-settings-view {
    .logo-placeholder {
        @extend .style-input;
        @extend .style-input-shadow;
        border: $border-width solid $color-border;
        color: $color-gray-5;
        background: $color-background;
        border-radius: $border-radius;
        padding: 5px 15px;
        height: 60px;
        margin: 0;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 0.2s, color 0.2s;
        outline: none;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        cursor: pointer;
        touch-action: manipulation;

        &:hover {
            border-color: $color-primary-gray-light;
            color: $color-primary;
        }

        &:active {
            border-color: $color-primary;
            color: $color-primary;
        }

        &.square {
            width: 60px;
        }

        &.horizontal {
            width: 300px;
        }
    }
}
</style>
