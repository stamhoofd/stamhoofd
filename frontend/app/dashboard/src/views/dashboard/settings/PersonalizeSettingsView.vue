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

<script lang="ts" setup>
import type { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import ColorInput from '@stamhoofd/components/inputs/ColorInput.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import ImageInput from '@stamhoofd/components/inputs/ImageInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { Image } from '@stamhoofd/structures';
import { Organization, OrganizationMetaData, ResolutionFit, ResolutionRequest, Version } from '@stamhoofd/structures';
import { computed, ref, shallowRef } from 'vue';



const baseOrganization = useRequiredOrganization();
const organizationManager = useOrganizationManager();
const dismiss = useDismiss();
const present = usePresent();
const errorBox = ref<ErrorBox | null>(null);
const validator = new Validator();
const saving = ref(false);
const organizationPatch = shallowRef<AutoEncoderPatchType<Organization> & AutoEncoder>(Organization.patch({ id: baseOrganization.value.id }));
const organization = computed(() => baseOrganization.value.patch(organizationPatch.value));
const enableMemberModule = computed(() => organization.value.meta.modules.useMembers);
const squareLogoResolutions = [
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
const horizontalLogoResolutions = [
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

function addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<Organization>>) {
    organizationPatch.value = organizationPatch.value.patch(Organization.patch(patch));
}

const color = computed({
    get: () => organization.value.meta.color,
    set: (color: string | null) => addPatch({
        meta: OrganizationMetaData.patch({
            color,
        }),
    }),
});
const squareLogo = computed({
    get: () => organization.value.meta.squareLogo,
    set: (squareLogo: Image | null) => addPatch({
        meta: OrganizationMetaData.patch({
            squareLogo,
        }),
    }),
});
const expandLogo = computed({
    get: () => organization.value.meta.expandLogo,
    set: (expandLogo: boolean) => addPatch({
        meta: OrganizationMetaData.patch({
            expandLogo,
        }),
    }),
});
const horizontalLogo = computed({
    get: () => organization.value.meta.horizontalLogo,
    set: (horizontalLogo: Image | null) => addPatch({
        meta: OrganizationMetaData.patch({
            horizontalLogo,
        }),
    }),
});
const isMailOk = computed(() => organization.value.privateMeta?.pendingMailDomain === null && organization.value.privateMeta?.mailDomain !== null);
const isRegisterOk = computed(() => organization.value.privateMeta?.pendingRegisterDomain === null && organization.value.registerDomain !== null);
const hasChanges = computed(() => patchContainsChanges(organizationPatch.value, baseOrganization.value, { version: Version }));

async function save() {
    if (saving.value) {
        return;
    }
    const errors = new SimpleErrors();
    errorBox.value = errors.errors.length ? new ErrorBox(errors) : null;
    if (errors.errors.length || !await validator.validate()) {
        return;
    }
    saving.value = true;
    try {
        await organizationManager.value.patch(organizationPatch.value);
        organizationPatch.value = Organization.patch({ id: baseOrganization.value.id });
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        await dismiss({ force: true });
    } catch (e) {
        errorBox.value = new ErrorBox(e);
    }
    saving.value = false;
}

async function setupDomain() {
    await present(new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./DomainSettingsView.vue'), {}),
    }).setDisplayStyle('popup'));
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({ shouldNavigateAway });
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#personalize-settings-view {
    .logo-placeholder {
        @extend %style-input;
        @extend %style-input-shadow;
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
