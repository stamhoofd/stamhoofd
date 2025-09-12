<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p />

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`042858d8-e3a2-4b78-acac-020ab4555819`)">
            <input v-model="$name" class="input" type="text" :placeholder="$t(`042858d8-e3a2-4b78-acac-020ab4555819`)">
        </STInputBox>

        <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`d3a81158-8af8-4c9d-825f-afe1d75f3dbd`)" :placeholder="$t(`dc5f036d-4aac-4894-8d3f-70ae0874ebcc`)" />

        <hr><h2>{{ $t('d101ec4a-219f-4f23-afa0-e8dc4862c354') }}</h2>
        <p>{{ $t('06c25477-62cb-45d0-b00d-dbe55af9947c') }}</p>

        <LogoEditor :meta-data="patched.config" :dark-mode="DarkMode.Auto" :validator="errors.validator" @patch="addPatch(Platform.patch({config: $event}))" />

        <ImageInput v-model="logoDocuments" :placeholder="patched.config.horizontalLogo ?? patched.config.squareLogo" :validator="errors.validator" :resolutions="printLogoResolutions" :required="false" :title="$t(`15d34e79-b5e5-4e99-b407-516e11fdb1d4`)" />

        <div>
            <div class="split-inputs">
                <div>
                    <ImageInput v-model="organizationLogo" :placeholder="patched.config.squareLogo ?? patched.config.horizontalLogo" :validator="errors.validator" :resolutions="organizationLogoResolutions" :required="false" :title="$t(`402b626e-6909-4e07-b246-04ad5a203e8e`)" />

                    <p class="style-description-small">
                        {{ $t('37d634d9-b756-419c-87c8-d83476865518') }}
                    </p>
                </div>

                <div>
                    <ImageInput v-model="organizationLogoDark" :placeholder="patched.config.squareLogoDark ?? patched.config.horizontalLogoDark" :validator="errors.validator" :resolutions="organizationLogoResolutions" :required="false" :dark="true" :title="$t(`aa45394d-82c6-480b-90d1-7011a7b78f24`)" />
                </div>
            </div>
        </div>

        <hr><h2 class="style-with-button">
            <div>{{ $t('b8a111c0-5f3d-480b-833a-6d7f05bf134d') }}</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="resolutions" />
            </div>
        </h2>
        <p>
            {{ $t('f04675f6-b5b5-4dd3-b891-406969d1e57b') }}
        </p>

        <p v-if="!coverPhoto" class="info-box">
            {{ $t('fe2882c9-2ce5-4a74-8d15-4d017cff2fec') }}
        </p>

        <ImageComponent v-if="coverPhoto" :image="coverPhoto" :auto-height="true" style="max-height: 400px;" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('19f89834-3e43-475d-a55b-d278bbca51cc') }}</div>
            <div>
                <button v-if="coverBottomLeftOverlayImage" type="button" class="button text only-icon-smartphone" @click="coverBottomLeftOverlayImage = null">
                    <span class="icon trash" />
                    <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                </button>
                <UploadButton v-model="coverBottomLeftOverlayImage" :text="coverBottomLeftOverlayImage ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="overlayResolutions" />
            </div>
        </h2>
        <p>{{ $t('f2ed302c-5e58-4d45-9071-baa30fde75d4') }}</p>

        <STInputBox :title="$t(`04ee201f-076f-4a3f-b10f-56eb10ca0d87`)">
            <NumberInput v-model="coverBottomLeftOverlayWidth" :validator="errors.validator" :min="10" suffix="px" :title="$t(`9f8d5e1a-6585-4b49-bbcb-6f9c4e9c51f2`)" />
        </STInputBox>

        <ImageComponent v-if="coverBottomLeftOverlayImage" :image="coverBottomLeftOverlayImage" :auto-height="true" :style="'width: ' + coverBottomLeftOverlayWidth + 'px'" />

        <hr><h2>{{ $t('089baffa-1456-48a4-ab5b-8994143c011b') }}</h2>

        <STInputBox error-fields="footerText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="footerText" editor-class="gray subtle-links" :placeholder="$t(`b99b7736-bf57-490b-ad09-425f1b89346e`)" />
        </STInputBox>

        <hr><h2>{{ $t('99b55ec2-7b90-4456-82bd-4168ab909822') }}</h2>

        <STInputBox error-fields="shopFooterText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="shopFooterText" editor-class="gray subtle-links" :placeholder="$t(`b99b7736-bf57-490b-ad09-425f1b89346e`)" />
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ColorInput, ErrorBox, ImageComponent, ImageInput, LogoEditor, NumberInput, STInputBox, Toast, UploadButton, useErrors, usePatch, usePlatform, WYSIWYGTextInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { DarkMode, Image, Platform, PlatformConfig, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();

const { patched, patch, hasChanges, addPatch } = usePatch(platform);
const saving = ref(false);

const title = $t(`c654281e-1993-4643-a876-94caa3a192ff`);

const $name = computed({
    get: () => patched.value.config.name,
    set: (value: string) => addPatch(Platform.patch({ config: PlatformConfig.patch({ name: value }) })),
});

const color = computed({
    get: () => patched.value.config.color,
    set: (value: string | null) => addPatch(Platform.patch({ config: PlatformConfig.patch({ color: value }) })),
});

const coverPhoto = computed({
    get: () => patched.value.config.coverPhoto,
    set: (value: Image | null) => addPatch(Platform.patch({ config: PlatformConfig.patch({ coverPhoto: value }) })),
});

const coverBottomLeftOverlayImage = computed({
    get: () => patched.value.config.coverBottomLeftOverlayImage,
    set: (value: Image | null) => addPatch(Platform.patch({ config: PlatformConfig.patch({ coverBottomLeftOverlayImage: value }) })),
});

const footerText = computed({
    get: () => patched.value.config.footerText,
    set: value => addPatch(Platform.patch({ config: PlatformConfig.patch({ footerText: value }) })),
});

const shopFooterText = computed({
    get: () => patched.value.config.shopFooterText,
    set: value => addPatch(Platform.patch({ config: PlatformConfig.patch({ shopFooterText: value }) })),
});

const logoDocuments = computed({
    get: () => patched.value.config.logoDocuments,
    set: (value: Image | null) => addPatch(Platform.patch({ config: PlatformConfig.patch({ logoDocuments: value }) })),
});

const organizationLogo = computed({
    get: () => patched.value.config.organizationLogo,
    set: (value: Image | null) => addPatch(Platform.patch({ config: PlatformConfig.patch({ organizationLogo: value }) })),
});

const organizationLogoDark = computed({
    get: () => patched.value.config.organizationLogoDark,
    set: (value: Image | null) => addPatch(Platform.patch({ config: PlatformConfig.patch({ organizationLogoDark: value }) })),
});

const coverBottomLeftOverlayWidth = computed({
    get: () => patched.value.config.coverBottomLeftOverlayWidth,
    set: (value: number) => {
        addPatch(Platform.patch({ config: PlatformConfig.patch({ coverBottomLeftOverlayWidth: value }) }));

        if (coverBottomLeftOverlayImage.value) {
            coverBottomLeftOverlayImage.value = null;
            Toast.error($t(`7ca281da-1720-4ac8-a043-f41eb1739999`)).setHide(15 * 1000).show();
        }
    },
});

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        await platformManager.value.patch(patch.value);
        new Toast($t(`17017abf-c2e0-4479-86af-300ad37347aa`), 'success green').show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

const organizationLogoResolutions = [
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

const resolutions = [
    ResolutionRequest.create({
        width: 1920,
    }),
    ResolutionRequest.create({
        width: 1280,
    }),
    ResolutionRequest.create({
        width: 960,
    }),
    ResolutionRequest.create({
        width: 700,
    }),
    ResolutionRequest.create({
        width: 600,
    }),
    ResolutionRequest.create({
        width: 300,
    }),
    ResolutionRequest.create({
        width: 100,
    }),
];

const printLogoResolutions = [
    ResolutionRequest.create({
        height: 120,
    }),
];

const overlayResolutions = computed(() => [
    ResolutionRequest.create({
        width: coverBottomLeftOverlayWidth.value,
    }),
    ResolutionRequest.create({
        width: coverBottomLeftOverlayWidth.value * 2,
    }),
    ResolutionRequest.create({
        width: coverBottomLeftOverlayWidth.value * 3,
    }),
],
);

defineExpose({
    shouldNavigateAway,
});
</script>
