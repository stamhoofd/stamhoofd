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

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { DarkMode, Image, OrganizationMetaData, PlatformConfig, ResolutionFit, ResolutionRequest, WebshopMetaData } from '@stamhoofd/structures';

import { Validator } from '../errors/Validator';
import Checkbox from '../inputs/Checkbox.vue';
import ImageInput from '../inputs/ImageInput.vue';

@Component({
    components: {
        Checkbox,
        ImageInput,
    },
})
export default class LogoEditor extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    metaData: WebshopMetaData | OrganizationMetaData | PlatformConfig;

    @Prop({ default: null })
    validator: Validator | null;

    @Prop({ default: DarkMode.Off })
    darkMode!: DarkMode;

    get squareLogo() {
        return this.metaData.squareLogo;
    }

    set squareLogo(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData | typeof PlatformConfig).patch({ squareLogo: image }));
    }

    get squareLogoPlaceholder() {
        return this.metaData.horizontalLogo ?? this.metaData.squareLogoDark ?? this.metaData.horizontalLogoDark;
    }

    get expandLogo() {
        return this.metaData.expandLogo;
    }

    set expandLogo(enable: boolean) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData).patch({ expandLogo: enable }));
    }

    get horizontalLogo() {
        return this.metaData.horizontalLogo;
    }

    set horizontalLogo(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData).patch({ horizontalLogo: image }));
    }

    get horizontalLogoPlaceholder() {
        return this.metaData.squareLogo ?? this.metaData.horizontalLogoDark ?? this.metaData.squareLogoDark;
    }

    get squareLogoDark() {
        return this.metaData.squareLogoDark;
    }

    set squareLogoDark(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData).patch({ squareLogoDark: image }));
    }

    get squareLogoDarkPlaceholder() {
        return this.metaData.horizontalLogoDark ?? this.metaData.squareLogo ?? this.metaData.horizontalLogo;
    }

    get horizontalLogoDark() {
        return this.metaData.horizontalLogoDark;
    }

    set horizontalLogoDark(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData).patch({ horizontalLogoDark: image }));
    }

    get horizontalLogoDarkPlaceholder() {
        return this.metaData.squareLogoDark ?? this.metaData.horizontalLogo ?? this.metaData.squareLogo;
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
}
</script>
