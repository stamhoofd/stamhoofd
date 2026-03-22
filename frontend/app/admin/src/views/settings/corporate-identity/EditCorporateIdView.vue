<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p />

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%Ha`)">
            <input v-model="$name" class="input" type="text" :placeholder="$t(`%Ha`)">
        </STInputBox>

        <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`%Hb`)" :placeholder="$t(`%Hc`)" />

        <hr><h2>{{ $t('%2D') }}</h2>
        <p>{{ $t('%HV') }}</p>

        <LogoEditor :meta-data="patched.config" :dark-mode="DarkMode.Auto" :validator="errors.validator" @patch="addPatch(Platform.patch({config: $event}))" />

        <ImageInput v-model="logoDocuments" :placeholder="patched.config.horizontalLogo ?? patched.config.squareLogo" :validator="errors.validator" :resolutions="printLogoResolutions" :required="false" :title="$t(`%Hd`)" />

        <div>
            <div class="split-inputs">
                <div>
                    <ImageInput v-model="organizationLogo" :placeholder="patched.config.squareLogo ?? patched.config.horizontalLogo" :validator="errors.validator" :resolutions="organizationLogoResolutions" :required="false" :title="$t(`%1EL`)" />

                    <p class="style-description-small">
                        {{ $t('%1EK') }}
                    </p>
                </div>

                <div>
                    <ImageInput v-model="organizationLogoDark" :placeholder="patched.config.squareLogoDark ?? patched.config.horizontalLogoDark" :validator="errors.validator" :resolutions="organizationLogoResolutions" :required="false" :dark="true" :title="$t(`%1EM`)" />
                </div>
            </div>
        </div>

        <hr><h2 class="style-with-button">
            <div>{{ $t('%7M') }}</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('%CJ') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`%He`) : $t(`%Hf`)" :resolutions="resolutions" />
            </div>
        </h2>
        <p>
            {{ $t('%HW') }}
        </p>

        <p v-if="!coverPhoto" class="info-box">
            {{ $t('%HX') }}
        </p>

        <ImageComponent v-if="coverPhoto" :image="coverPhoto" :auto-height="true" style="max-height: 400px;" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('%HY') }}</div>
            <div>
                <button v-if="coverBottomLeftOverlayImage" type="button" class="button text only-icon-smartphone" @click="coverBottomLeftOverlayImage = null">
                    <span class="icon trash" />
                    <span>{{ $t('%CJ') }}</span>
                </button>
                <UploadButton v-model="coverBottomLeftOverlayImage" :text="coverBottomLeftOverlayImage ? $t(`%He`) : $t(`%Hf`)" :resolutions="overlayResolutions" />
            </div>
        </h2>
        <p>{{ $t('%HZ') }}</p>

        <STInputBox :title="$t(`%Hg`)">
            <NumberInput v-model="coverBottomLeftOverlayWidth" :validator="errors.validator" :min="10" suffix="px" :title="$t(`%Hh`)" />
        </STInputBox>

        <ImageComponent v-if="coverBottomLeftOverlayImage" :image="coverBottomLeftOverlayImage" :auto-height="true" :style="'width: ' + coverBottomLeftOverlayWidth + 'px'" />

        <hr><h2>{{ $t('%M') }}</h2>

        <STInputBox error-fields="footerText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="footerText" editor-class="gray subtle-links" :placeholder="$t(`%Hi`)" />
        </STInputBox>

        <hr><h2>{{ $t('%1Z') }}</h2>

        <STInputBox error-fields="shopFooterText" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="shopFooterText" editor-class="gray subtle-links" :placeholder="$t(`%Hi`)" />
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import ColorInput from '@stamhoofd/components/inputs/ColorInput.vue';
import ImageInput from '@stamhoofd/components/inputs/ImageInput.vue';
import NumberInput from '@stamhoofd/components/inputs/NumberInput.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import UploadButton from '@stamhoofd/components/inputs/UploadButton.vue';
import WYSIWYGTextInput from '@stamhoofd/components/inputs/WYSIWYGTextInput.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import ImageComponent from '@stamhoofd/components/views/ImageComponent.vue';
import LogoEditor from '@stamhoofd/components/views/LogoEditor.vue';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import type { Image} from '@stamhoofd/structures';
import { DarkMode, Platform, PlatformConfig, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();

const { patched, patch, hasChanges, addPatch } = usePatch(platform);
const saving = ref(false);

const title = $t(`%5d`);

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
            Toast.error($t(`%Hj`)).setHide(15 * 1000).show();
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
        new Toast($t(`%HA`), 'success green').show();
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
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
