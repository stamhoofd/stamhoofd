<template>
    <SaveView id="personalize-settings-view" :loading="saving" :disabled="!hasChanges" :title="$t(`%ty`)" @save="save">
        <h1>
            {{ $t('%ty') }}
        </h1>
        <p>{{ $t('%OA') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogo" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :title="$t(`%OO`)" />

                <p class="style-description-small">
                    {{ $t('%OB') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogo" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :title="$t(`%OP`)" />
                <p class="style-description-small">
                    {{ $t('%OC') }}
                </p>
            </div>
        </div>

        <Checkbox v-model="expandLogo">
            {{ $t('%OD') }}
        </Checkbox>
        <p class="style-description-small">
            {{ $t('%OE') }}
        </p>

        <ColorInput v-model="color" :validator="validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`%OQ`)" :placeholder="$t(`%Hc`)" />
        <p class="style-description-small">
            {{ $t('%OF') }}
        </p>

        <div v-if="STAMHOOFD.userMode === 'organization'" class="container">
            <hr><h2>{{ $t('%NE') }}</h2>

            <p>{{ $t('%OG') }} <a class="inline-link" :href="$domains.getDocs('domeinnaam-koppelen')" target="_blank">{{ $t('%OH') }}</a>.</p>

            <template v-if="organization.privateMeta && (organization.privateMeta.mailDomain || organization.privateMeta.pendingMailDomain || organization.privateMeta.pendingRegisterDomain || organization.registerDomain)">
                <p v-if="isMailOk" class="success-box">
                    {{ $t('%N5') }} <template v-if="!organization.privateMeta.mailDomainActive">
                        {{ $t('%OI') }}
                    </template>
                </p>
                <p v-else class="warning-box">
                    {{ $t('%43') }}
                </p>

                <template v-if="enableMemberModule">
                    <p v-if="isRegisterOk" class="success-box">
                        {{ $t('%OJ') }} {{ organization.registerDomain }})
                    </p>
                    <p v-else class="warning-box">
                        {{ $t("%ON") }}
                    </p>
                </template>

                <p v-if="isMailOk && (isRegisterOk || !enableMemberModule)" class="style-button-bar">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings" />
                        <span>{{ $t('%OK') }}</span>
                    </button>
                </p>

                <p v-else class="style-button-bar">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings" />
                        <span>{{ $t('%OL') }}</span>
                    </button>
                </p>
            </template>

            <template v-else>
                <p v-if="organization.registerUrl && enableMemberModule" class="style-description-block">
                    {{ $t('%OM') }} <a class="button inline-link" :href="organization.registerUrl" target="_blank">{{ organization.registerUrl }}</a>. {{ $t('%2t') }}
                </p>
                <p v-else class="style-description-block">
                    {{ $t('%2s') }}
                </p>

                <p class="style-button-bar">
                    <button class="button text" type="button" @click="setupDomain">
                        <span class="icon settings" />
                        <span>{{ $t('%OL') }}</span>
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
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import ColorInput from '@stamhoofd/components/inputs/ColorInput.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import ImageInput from '@stamhoofd/components/inputs/ImageInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
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
