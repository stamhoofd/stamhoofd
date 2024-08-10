<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p />

        <STErrorsDefault :error-box="errors.errorBox" />

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

        <p class="info-box" v-if="!coverPhoto">
            Geen omslagfoto ingesteld
        </p>

        <ImageComponent v-if="coverPhoto" :image="coverPhoto" :auto-height="true" style="max-height: 400px;" />
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ColorInput, ErrorBox, LogoEditor, Toast, useErrors, usePatch, usePlatform, ImageComponent, UploadButton } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { DarkMode, Platform, PlatformConfig, ResolutionRequest } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const $t = useTranslate();

const {patched, patch, hasChanges, addPatch} = usePatch(platform)
const saving = ref(false);

const title = 'Huisstijl'

const color = computed({
    get: () => patched.value.config.color,
    set: (value: string) => addPatch(Platform.patch({config: PlatformConfig.patch({color: value})}))
})

const coverPhoto = computed({
    get: () => patched.value.config.coverPhoto,
    set: (value: string | null) => addPatch(Platform.patch({config: PlatformConfig.patch({coverPhoto: value})}))
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

defineExpose({
    shouldNavigateAway
})
</script>
