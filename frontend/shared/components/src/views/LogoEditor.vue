<template>
    <div>
        <div v-if="darkMode === 'Off' || darkMode === 'Auto'" class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogo" :placeholder="horizontalLogoPlaceholder" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :title="$t(`872ed300-befc-44a1-b989-1c0af2f2ab23`)" />

                <p class="style-description-small">
                    {{ $t('573cb04e-77e2-408c-aecd-abd36759a0fc') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogo" :placeholder="squareLogoPlaceholder" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :title="$t(`408b5a17-3902-4483-b9cb-38d581ad3b97`)" />
                <p class="style-description-small">
                    {{ $t('b0bcf568-cbb0-4c55-9401-54a8bbcc2e72') }}
                </p>
            </div>
        </div>
        <div v-if="darkMode === 'On' || darkMode === 'Auto'" class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogoDark" :placeholder="horizontalLogoDarkPlaceholder" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :dark="true" :title="$t(`b460f9b2-ffd8-48c4-b4e0-57c360f0affc`)" />

                <p class="style-description-small">
                    {{ $t('b511b29e-c50f-4332-a357-9f25d3277fd9') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogoDark" :placeholder="squareLogoDarkPlaceholder" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :dark="true" :title="$t(`408b5a17-3902-4483-b9cb-38d581ad3b97`)" />
                <p class="style-description-small">
                    {{ $t('7e37a459-c43c-4123-a42d-acc9d8a0e624') }}
                </p>
            </div>
        </div>

        <Checkbox v-model="expandLogo">
            {{ $t('9e68d551-a532-4681-9040-95e4c0f673aa') }}
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
