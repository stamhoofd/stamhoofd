<template>
    <div>
        <div v-if="darkMode === 'Off' || darkMode === 'Auto'" class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogo" :placeholder="horizontalLogoPlaceholder" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :title="$t(`%kB`)" />

                <p class="style-description-small">
                    {{ $t('%k7') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogo" :placeholder="squareLogoPlaceholder" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :title="$t(`%kC`)" />
                <p class="style-description-small">
                    {{ $t('%k8') }}
                </p>
            </div>
        </div>
        <div v-if="darkMode === 'On' || darkMode === 'Auto'" class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogoDark" :placeholder="horizontalLogoDarkPlaceholder" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :dark="true" :title="$t(`%kD`)" />

                <p class="style-description-small">
                    {{ $t('%k9') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogoDark" :placeholder="squareLogoDarkPlaceholder" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :dark="true" :title="$t(`%kC`)" />
                <p class="style-description-small">
                    {{ $t('%kA') }}
                </p>
            </div>
        </div>

        <Checkbox v-model="expandLogo">
            {{ $t('%OD') }}
        </Checkbox>
    </div>
</template>

<script lang="ts" setup>
import type { Image, OrganizationMetaData, PlatformConfig, WebshopMetaData } from '@stamhoofd/structures';
import { DarkMode, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';
import { computed } from 'vue';

import type { Validator } from '../errors/Validator';
import Checkbox from '../inputs/Checkbox.vue';
import ImageInput from '../inputs/ImageInput.vue';

const props = withDefaults(defineProps<{
    metaData: WebshopMetaData | OrganizationMetaData | PlatformConfig;
    validator?: Validator | null;
    darkMode?: DarkMode;
}>(), {
    validator: null,
    darkMode: DarkMode.Off,
});

const emit = defineEmits(['patch']);

const patch = (value: object) => emit('patch', (props.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData | typeof PlatformConfig).patch(value));

const squareLogo = computed({
    get: () => props.metaData.squareLogo,
    set: (image: Image | null) => patch({ squareLogo: image }),
});
const squareLogoPlaceholder = computed(() => props.metaData.horizontalLogo ?? props.metaData.squareLogoDark ?? props.metaData.horizontalLogoDark);
const expandLogo = computed({
    get: () => props.metaData.expandLogo,
    set: (enable: boolean) => patch({ expandLogo: enable }),
});
const horizontalLogo = computed({
    get: () => props.metaData.horizontalLogo,
    set: (image: Image | null) => patch({ horizontalLogo: image }),
});
const horizontalLogoPlaceholder = computed(() => props.metaData.squareLogo ?? props.metaData.horizontalLogoDark ?? props.metaData.squareLogoDark);
const squareLogoDark = computed({
    get: () => props.metaData.squareLogoDark,
    set: (image: Image | null) => patch({ squareLogoDark: image }),
});
const squareLogoDarkPlaceholder = computed(() => props.metaData.horizontalLogoDark ?? props.metaData.squareLogo ?? props.metaData.horizontalLogo);
const horizontalLogoDark = computed({
    get: () => props.metaData.horizontalLogoDark,
    set: (image: Image | null) => patch({ horizontalLogoDark: image }),
});
const horizontalLogoDarkPlaceholder = computed(() => props.metaData.squareLogoDark ?? props.metaData.horizontalLogo ?? props.metaData.squareLogo);

const squareLogoResolutions = [
    ResolutionRequest.create({ height: 50, width: 50, fit: ResolutionFit.Inside }),
    ResolutionRequest.create({ height: 70, width: 70, fit: ResolutionFit.Inside }),
    ResolutionRequest.create({ height: 50 * 3, width: 50 * 3, fit: ResolutionFit.Inside }),
    ResolutionRequest.create({ height: 70 * 3, width: 70 * 3, fit: ResolutionFit.Inside }),
    ResolutionRequest.create({ height: 70 * 3, width: 70 * 3, fit: ResolutionFit.Inside }),
];

const horizontalLogoResolutions = [
    ResolutionRequest.create({ height: 50, width: 300, fit: ResolutionFit.Inside }),
    ResolutionRequest.create({ height: 70, width: 300, fit: ResolutionFit.Inside }),
    ResolutionRequest.create({ height: 50 * 3, width: 300 * 3, fit: ResolutionFit.Inside }),
    ResolutionRequest.create({ height: 70 * 3, width: 300 * 3, fit: ResolutionFit.Inside }),
];
</script>
