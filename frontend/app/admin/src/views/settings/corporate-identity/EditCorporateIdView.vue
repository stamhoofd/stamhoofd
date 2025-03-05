<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p/>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`419197c4-b0bc-45e7-a4b8-29d8c9b708a0`)">
            <input v-model="$name" class="input" type="text" :placeholder="$t(`419197c4-b0bc-45e7-a4b8-29d8c9b708a0`)"></STInputBox>

        <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`a0f5b4f7-49b2-49b5-86b4-676146230256`)" :placeholder="$t(`e122f3ae-6d69-4b24-88f1-1bb48288812c`)"/>

        <hr><h2>{{ $t('f1b4c303-d49b-4e3f-849c-589bb8b8348a') }}</h2>
        <p>{{ $t('073af355-d1fb-4505-bf66-4cbfa65689a9') }}</p>

        <LogoEditor :meta-data="patched.config" :dark-mode="DarkMode.Auto" :validator="errors.validator" @patch="addPatch(Platform.patch({config: $event}))"/>

        <ImageInput v-model="logoDocuments" :placeholder="patched.config.horizontalLogo ?? patched.config.squareLogo" :validator="errors.validator" :resolutions="printLogoResolutions" :required="false" :title="$t(`2efdfc0a-42be-46ac-8917-c18c61a5a038`)"/>

        <hr><h2 class="style-with-button">
            <div>{{ $t('e4a90efd-a536-472b-8f3f-cbd0fac0ba82') }}</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash"/>
                    <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`c01d3d4e-ad4e-45ec-abac-431462c194cf`) : $t(`3370bb72-2817-4096-83ce-318993436513`)" :resolutions="resolutions"/>
            </div>
        </h2>
        <p>
            {{ $t('57d03c8b-e238-4df0-a4e7-620df46ebd99') }}
        </p>

        <p v-if="!coverPhoto" class="info-box">
            {{ $t('c92726a8-7636-470d-8987-c8bc343ae14a') }}
        </p>

        <ImageComponent v-if="coverPhoto" :image="coverPhoto" :auto-height="true" style="max-height: 400px;"/>

        <hr><h2 class="style-with-button">
            <div>{{ $t('0d05108a-b27e-4e71-870e-c358a843a576') }}</div>
            <div>
                <button v-if="coverBottomLeftOverlayImage" type="button" class="button text only-icon-smartphone" @click="coverBottomLeftOverlayImage = null">
                    <span class="icon trash"/>
                    <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                </button>
                <UploadButton v-model="coverBottomLeftOverlayImage" :text="coverBottomLeftOverlayImage ? $t(`c01d3d4e-ad4e-45ec-abac-431462c194cf`) : $t(`3370bb72-2817-4096-83ce-318993436513`)" :resolutions="overlayResolutions"/>
            </div>
        </h2>
        <p>{{ $t('4218ec8e-e1e3-4fca-a056-51c211b42eaa') }}</p>

        <STInputBox :title="$t(`eaa3d3d5-6bc9-4148-9811-9011fac914a7`)">
            <NumberInput v-model="coverBottomLeftOverlayWidth" :validator="errors.validator" :min="10" suffix="px" :title="$t(`93e8ac47-759d-4c00-abb7-4021a1c11619`)"/>
        </STInputBox>

        <ImageComponent v-if="coverBottomLeftOverlayImage" :image="coverBottomLeftOverlayImage" :auto-height="true" :style="'width: ' + coverBottomLeftOverlayWidth + 'px'"/>

        <hr><h2>{{ $t('60a0c06c-5ddd-4d4a-b9a6-2bb7c927ac47') }}</h2>

        <STInputBox error-fields="footerText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="footerText" editor-class="gray subtle-links" :placeholder="$t(`33c83847-349a-4d1b-b9a5-4b2ece19055c`)"/>
        </STInputBox>

        <hr><h2>{{ $t('23969e27-133d-4159-8b08-9b7afe2757d9') }}</h2>

        <STInputBox error-fields="shopFooterText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="shopFooterText" editor-class="gray subtle-links" :placeholder="$t(`33c83847-349a-4d1b-b9a5-4b2ece19055c`)"/>
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ColorInput, ErrorBox, ImageComponent, LogoEditor, NumberInput, STInputBox, Toast, UploadButton, useErrors, usePatch, usePlatform, WYSIWYGTextInput, ImageInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { DarkMode, Image, Platform, PlatformConfig, ResolutionRequest } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const $t = useTranslate();

const { patched, patch, hasChanges, addPatch } = usePatch(platform);
const saving = ref(false);

const title = 'Huisstijl';

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

const coverBottomLeftOverlayWidth = computed({
    get: () => patched.value.config.coverBottomLeftOverlayWidth,
    set: (value: number) => {
        addPatch(Platform.patch({ config: PlatformConfig.patch({ coverBottomLeftOverlayWidth: value }) }));

        if (coverBottomLeftOverlayImage.value) {
            coverBottomLeftOverlayImage.value = null;
            Toast.error('Upload een nieuwe overlay: je kan de breedte enkel aanpassen VOOR het uploaden - anders kunnen we de resolutie niet correct afstemmen op alle apparaten. Wil je jouw aanpassing ongedaan maken? Klik dan op het kruisje en sla niet op.').setHide(15 * 1000).show();
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
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
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
