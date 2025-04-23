<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p />

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`Naam van het platform`)">
            <input v-model="$name" class="input" type="text" :placeholder="$t(`Naam van het platform`)">
        </STInputBox>

        <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`Hoofdkleur`)" :placeholder="$t(`Geen kleur`)" />

        <hr><h2>{{ $t('Logo') }}</h2>
        <p>{{ $t('Let op: het logo van de app in de AppStores moet via een app-update aangepast worden.') }}</p>

        <LogoEditor :meta-data="patched.config" :dark-mode="DarkMode.Auto" :validator="errors.validator" @patch="addPatch(Platform.patch({config: $event}))" />

        <ImageInput v-model="logoDocuments" :placeholder="patched.config.horizontalLogo ?? patched.config.squareLogo" :validator="errors.validator" :resolutions="printLogoResolutions" :required="false" :title="$t(`Logo op documenten (PDF)`)" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('Omslagfoto') }}</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('Verwijderen') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`Vervangen`) : $t(`Uploaden`)" :resolutions="resolutions" />
            </div>
        </h2>
        <p>
            {{ $t('Deze foto wordt gebruikt op de inlogpagina. Kies bij voorkeur een foto die goed in een portretformaat past.') }}
        </p>

        <p v-if="!coverPhoto" class="info-box">
            {{ $t('Geen omslagfoto ingesteld') }}
        </p>

        <ImageComponent v-if="coverPhoto" :image="coverPhoto" :auto-height="true" style="max-height: 400px;" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('Omslagfoto overlay') }}</div>
            <div>
                <button v-if="coverBottomLeftOverlayImage" type="button" class="button text only-icon-smartphone" @click="coverBottomLeftOverlayImage = null">
                    <span class="icon trash" />
                    <span>{{ $t('Verwijderen') }}</span>
                </button>
                <UploadButton v-model="coverBottomLeftOverlayImage" :text="coverBottomLeftOverlayImage ? $t(`Vervangen`) : $t(`Uploaden`)" :resolutions="overlayResolutions" />
            </div>
        </h2>
        <p>{{ $t('Deze afbeelding wordt in de linkeronderhoek van de omslagfoto geplaatst. Kies bij voorkeur een mét een achtergrondkleur dat hier goed op werd aangepast.') }}</p>

        <STInputBox :title="$t(`Breedte`)">
            <NumberInput v-model="coverBottomLeftOverlayWidth" :validator="errors.validator" :min="10" suffix="px" :title="$t(`Transparantie`)" />
        </STInputBox>

        <ImageComponent v-if="coverBottomLeftOverlayImage" :image="coverBottomLeftOverlayImage" :auto-height="true" :style="'width: ' + coverBottomLeftOverlayWidth + 'px'" />

        <hr><h2>{{ $t('Footer') }}</h2>

        <STInputBox error-fields="footerText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="footerText" editor-class="gray subtle-links" :placeholder="$t(`Tekst en links die onderaan in de footer zichtbaar zijn`)" />
        </STInputBox>

        <hr><h2>{{ $t('Webshop footer') }}</h2>

        <STInputBox error-fields="shopFooterText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="shopFooterText" editor-class="gray subtle-links" :placeholder="$t(`Tekst en links die onderaan in de footer zichtbaar zijn`)" />
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ColorInput, ErrorBox, ImageComponent, ImageInput, LogoEditor, NumberInput, STInputBox, Toast, UploadButton, useErrors, usePatch, usePlatform, WYSIWYGTextInput } from '@stamhoofd/components';
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

const title = $t(`Huisstijl`);

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
            Toast.error($t(`Upload een nieuwe overlay: je kan de breedte enkel aanpassen VOOR het uploaden - anders kunnen we de resolutie niet correct afstemmen op alle apparaten. Wil je jouw aanpassing ongedaan maken? Klik dan op het kruisje en sla niet op.`)).setHide(15 * 1000).show();
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
        new Toast($t(`De wijzigingen zijn opgeslagen`), 'success green').show();
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
