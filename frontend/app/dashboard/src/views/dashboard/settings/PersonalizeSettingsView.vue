<template>
    <SaveView id="personalize-settings-view" :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`Personaliseren`)">
        <h1>
            {{ $t('ba0f4e0a-0e1e-4fd2-8078-2ff1956e3396') }}
        </h1>
        <p>{{ $t('f761b1f2-b6da-49ec-8e64-91aa4dbeb8b7') }}</p>

        <STErrorsDefault :error-box="errorBox"/>

        <div class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogo" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :title="$t(`59924b9c-ddf1-4d91-8dd9-0fa957190e6e`)"/>

                <p class="st-list-description">
                    {{ $t('d61be3d6-607f-4289-a319-54da109b87d0') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogo" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :title="$t(`4fbc3334-41b5-4dfb-8928-5835357ebdd8`)"/>
                <p class="st-list-description">
                    {{ $t('17118694-a6de-402b-8ca0-03a95d5ac8d9') }}
                </p>
            </div>
        </div>

        <Checkbox v-model="expandLogo">
            {{ $t('a100125a-d7f9-4f4c-98ef-c0a42dda44bc') }}
        </Checkbox>
        <p class="st-list-description">
            {{ $t('1d29d6e1-d1ed-4151-83d0-a7d5a5ffd877') }}
        </p>

        <ColorInput v-model="color" :validator="validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`14a3d334-8815-495c-8941-cd6842b1a88e`)" :placeholder="$t(`e122f3ae-6d69-4b24-88f1-1bb48288812c`)"/>
        <p class="st-list-description">
            {{ $t('d878ef06-b4f9-42d2-96bc-ed627941549f') }}
        </p>

        <template v-if="STAMHOOFD.userMode === 'organization'">
            <hr><h2>{{ $t('838c80f3-bf67-48eb-9475-5ac3a45ad28e') }}</h2>

            <p>{{ $t('c01dbe73-74b1-4e01-aae3-51de074d605e') }} <a class="inline-link" :href="$domains.getDocs('domeinnaam-koppelen')" target="_blank">{{ $t('7fd04b13-e600-49b1-bafb-e4f642154bcd') }}</a>.</p>

            <template v-if="organization.privateMeta && (organization.privateMeta.mailDomain || organization.privateMeta.pendingMailDomain || organization.privateMeta.pendingRegisterDomain || organization.registerDomain)">
                <p v-if="isMailOk" class="success-box">
                    {{ $t('642b317f-4516-42da-a6ea-6cfa40c9f8be') }} <template v-if="!organization.privateMeta.mailDomainActive">
                        {{ $t('ac941775-879f-4d97-8981-2a07179fec48') }}
                    </template>
                </p>
                <p v-else class="warning-box">
                    {{ $t('94547449-549d-4572-b217-c1a089b12997') }}
                </p>

                <template v-if="enableMemberModule">
                    <p v-if="isRegisterOk" class="success-box">
                        {{ $t('7325092e-4648-4c9e-a288-ec37c8c411d5') }} {{ organization.registerDomain }})
                    </p>
                    <p v-else class="warning-box">
                        {{ $t("d95aa6b9-c9b4-481f-9a7a-481229b3970a") }}
                    </p>
                </template>

                <p v-if="isMailOk && (isRegisterOk || !enableMemberModule)" class="st-list-description">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings"/>
                        <span>{{ $t('1b93f1ce-0305-4fb5-920a-7c9751c66237') }}</span>
                    </button>
                </p>

                <p v-else class="st-list-description">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings"/>
                        <span>{{ $t('a48bccec-baf5-4cb9-8e3e-ab85fd97b9fb') }}</span>
                    </button>
                </p>
            </template>

            <template v-else>
                <p v-if="organization.registerUrl && enableMemberModule" class="st-list-description">
                    {{ $t('0da3b89b-080a-44a3-9a34-5b6056f245c4') }} <a class="button inline-link" :href="organization.registerUrl" target="_blank">{{ organization.registerUrl }}</a>. {{ $t('57e20ed4-d50a-4947-96fc-57958550dcfa') }}
                </p>
                <p v-else class="st-list-description">
                    {{ $t('8b32118a-658d-4e17-96f9-a009449ec342') }}
                </p>

                <p class="st-list-description">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings"/>
                        <span>{{ $t('a48bccec-baf5-4cb9-8e3e-ab85fd97b9fb') }}</span>
                    </button>
                </p>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ColorInput, ErrorBox, ImageInput, SaveView, STErrorsDefault, Toast, Validator } from '@stamhoofd/components';
import { Image, Organization, OrganizationMetaData, OrganizationPatch, ResolutionFit, ResolutionRequest, Version } from '@stamhoofd/structures';

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

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({});

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
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id });
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
