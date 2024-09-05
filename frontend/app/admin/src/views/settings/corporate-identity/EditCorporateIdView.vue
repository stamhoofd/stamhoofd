<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p />

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Naam van het platform" error-fields="name" :error-box="errors.errorBox">
            <input
                v-model="$name"
                class="input"
                type="text"
                placeholder="Naam van het platform"
            >
        </STInputBox>

        <ColorInput v-model="color" title="Hoofdkleur" :validator="errors.validator" placeholder="Geen kleur" :required="false" :disallowed="['#FFFFFF']" />

        <hr>
        <h2>Logo</h2>
        <p>Let op: het logo van de app in de AppStores moet via een app-update aangepast worden.</p>

        <LogoEditor :meta-data="patched.config" :dark-mode="DarkMode.Auto" :validator="errors.validator" @patch="addPatch(Platform.patch({config: $event}))" />

        <hr>
        <h2 class="style-with-button">
            <div>Omslagfoto</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Uploaden'" :resolutions="resolutions" />
            </div>
        </h2>
        <p>
            Deze foto wordt gebruikt op de inlogpagina. Kies bij voorkeur een foto die goed in een portretformaat past.
        </p>

        <p v-if="!coverPhoto" class="info-box">
            Geen omslagfoto ingesteld
        </p>

        <ImageComponent v-if="coverPhoto" :image="coverPhoto" :auto-height="true" style="max-height: 400px;" />

        <hr>
        <h2 class="style-with-button">
            <div>Omslagfoto overlay</div>
            <div>
                <button v-if="coverBottomLeftOverlayImage" type="button" class="button text only-icon-smartphone" @click="coverBottomLeftOverlayImage = null">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <UploadButton v-model="coverBottomLeftOverlayImage" :text="coverBottomLeftOverlayImage ? 'Vervangen' : 'Uploaden'" :resolutions="overlayResolutions" />
            </div>
        </h2>
        <p>Deze afbeelding wordt in de linkeronderhoek van de omslagfoto geplaatst. Kies bij voorkeur een mét een achtergrondkleur dat hier goed op werd aangepast.</p>

        <STInputBox title="Breedte">
            <NumberInput v-model="coverBottomLeftOverlayWidth" title="Transparantie" :validator="errors.validator" :min="10" suffix="px" />
        </STInputBox>

        <ImageComponent v-if="coverBottomLeftOverlayImage" :image="coverBottomLeftOverlayImage" :auto-height="true" :style="'width: ' + coverBottomLeftOverlayWidth + 'px'" />

        <hr>
        <h2>Footer</h2>
        
        <STInputBox error-fields="footerText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput
                v-model="footerText"
                placeholder="Tekst die naast het aanvinkvakje staat"
                editor-class="gray subtle-links"
            />
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ColorInput, ErrorBox, ImageComponent, LogoEditor, NumberInput, STInputBox, Toast, UploadButton, useErrors, usePatch, usePlatform, WYSIWYGTextInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { DarkMode, Image, Platform, PlatformConfig, ResolutionRequest } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const $t = useTranslate();

const {patched, patch, hasChanges, addPatch} = usePatch(platform)
const saving = ref(false);

const title = 'Huisstijl'

const $name = computed({
    get: () => patched.value.config.name,
    set: (value: string) => addPatch(Platform.patch({config: PlatformConfig.patch({name: value})}))
})

const color = computed({
    get: () => patched.value.config.color,
    set: (value: string | null) => addPatch(Platform.patch({config: PlatformConfig.patch({color: value})}))
})

const coverPhoto = computed({
    get: () => patched.value.config.coverPhoto,
    set: (value: Image | null) => addPatch(Platform.patch({config: PlatformConfig.patch({coverPhoto: value})}))
})

const coverBottomLeftOverlayImage = computed({
    get: () => patched.value.config.coverBottomLeftOverlayImage,
    set: (value: Image | null) => addPatch(Platform.patch({config: PlatformConfig.patch({coverBottomLeftOverlayImage: value})}))
})

const footerText = computed({
    get: () => patched.value.config.footerText,
    set: (value) => addPatch(Platform.patch({config: PlatformConfig.patch({footerText: value})}))
})

const coverBottomLeftOverlayWidth = computed({
    get: () => patched.value.config.coverBottomLeftOverlayWidth,
    set: (value: number) => {
        addPatch(Platform.patch({config: PlatformConfig.patch({coverBottomLeftOverlayWidth: value})}));

        if (coverBottomLeftOverlayImage.value) {
            coverBottomLeftOverlayImage.value = null;
            Toast.error('Upload een nieuwe overlay: je kan de breedte enkel aanpassen VOOR het uploaden - anders kunnen we de resolutie niet correct afstemmen op alle apparaten. Wil je jouw aanpassing ongedaan maken? Klik dan op het kruisje en sla niet op.').setHide(15 * 1000).show()
        }
    }
})

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
        
        await platformManager.value.patch(patch.value)
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;

}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

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
        width: 300
    }),
    ResolutionRequest.create({
        width: 100
    })
]

const overlayResolutions = computed(() => [
    ResolutionRequest.create({
        width: coverBottomLeftOverlayWidth.value,
    }),
    ResolutionRequest.create({
        width: coverBottomLeftOverlayWidth.value * 2,
    }),
    ResolutionRequest.create({
        width: coverBottomLeftOverlayWidth.value * 3,
    })
]
);

defineExpose({
    shouldNavigateAway
})
</script>
