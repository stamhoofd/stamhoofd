<template>
    <div>
        <div v-if="darkMode === 'Off' || darkMode === 'Auto'" class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogo" :placeholder="horizontalLogoPlaceholder" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :title="$t(`1b6c6e8b-7d8c-4f44-960d-9c1d5d9d6da3`)"/>

                <p class="style-description-small">
                    {{ $t('d90edbb2-1b30-4be6-b3d9-77dac0330003') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogo" :placeholder="squareLogoPlaceholder" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :title="$t(`ef99f621-819e-427d-88d4-b3ceb1678a95`)"/>
                <p class="style-description-small">
                    {{ $t('a5055894-3259-4fa4-9985-3de7743fa73e') }}
                </p>
            </div>
        </div>
        <div v-if="darkMode === 'On' || darkMode === 'Auto'" class="split-inputs">
            <div>
                <ImageInput v-model="horizontalLogoDark" :placeholder="horizontalLogoDarkPlaceholder" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :dark="true" :title="$t(`2722181f-a039-4a15-9f9a-78c82989b9fa`)"/>

                <p class="style-description-small">
                    {{ $t('9402be87-13db-4fb4-bc72-ad877b85b4ee') }}
                </p>
            </div>

            <div>
                <ImageInput v-model="squareLogoDark" :placeholder="squareLogoDarkPlaceholder" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :dark="true" :title="$t(`ef99f621-819e-427d-88d4-b3ceb1678a95`)"/>
                <p class="style-description-small">
                    {{ $t('199a4c91-2807-44bf-9f24-59814904feff') }}
                </p>
            </div>
        </div>

        <Checkbox v-model="expandLogo">
            {{ $t('a100125a-d7f9-4f4c-98ef-c0a42dda44bc') }}
        </Checkbox>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { DarkMode, Image, OrganizationMetaData, PlatformConfig, ResolutionFit, ResolutionRequest, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { Validator } from '../errors/Validator';
import Checkbox from '../inputs/Checkbox.vue';
import ImageInput from '../inputs/ImageInput.vue';

@Component({
    components: {
        Checkbox,
        ImageInput
    }
})
export default class LogoEditor extends Mixins(NavigationMixin) {
    @Prop({ required: true }) 
        metaData: WebshopMetaData | OrganizationMetaData | PlatformConfig
    
    @Prop({ default: null }) 
        validator: Validator | null

    @Prop({ default: DarkMode.Off }) 
        darkMode!: DarkMode

    get squareLogo() {
        return this.metaData.squareLogo
    }

    set squareLogo(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData | typeof PlatformConfig).patch({ squareLogo: image }))
    }

    get squareLogoPlaceholder() {
        return this.metaData.horizontalLogo ?? this.metaData.squareLogoDark ?? this.metaData.horizontalLogoDark
    }

    get expandLogo() {
        return this.metaData.expandLogo
    }

    set expandLogo(enable: boolean) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData).patch({ expandLogo: enable }))
    }


    get horizontalLogo() {
        return this.metaData.horizontalLogo
    }

    set horizontalLogo(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData).patch({ horizontalLogo: image }))
    }

    get horizontalLogoPlaceholder() {
        return this.metaData.squareLogo ?? this.metaData.horizontalLogoDark ?? this.metaData.squareLogoDark
    }

    get squareLogoDark() {
        return this.metaData.squareLogoDark
    }

    set squareLogoDark(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData| typeof OrganizationMetaData).patch({ squareLogoDark: image }))
    }

    get squareLogoDarkPlaceholder() {
        return this.metaData.horizontalLogoDark ?? this.metaData.squareLogo ?? this.metaData.horizontalLogo
    }

    get horizontalLogoDark() {
        return this.metaData.horizontalLogoDark
    }

    set horizontalLogoDark(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData| typeof OrganizationMetaData).patch({ horizontalLogoDark: image }))
    }

    get horizontalLogoDarkPlaceholder() {
        return this.metaData.squareLogoDark ?? this.metaData.horizontalLogo ?? this.metaData.squareLogo
    }

    get squareLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 50,
                width: 50,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70,
                width: 70,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 50*3,
                width: 50*3,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70*3,
                width: 70*3,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70*3,
                width: 70*3,
                fit: ResolutionFit.Inside
            })
        ]
    }

    get horizontalLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 50,
                width: 300,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70,
                width: 300,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 50*3,
                width: 300*3,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 70*3,
                width: 300*3,
                fit: ResolutionFit.Inside
            }),
        ]
    }
}
</script>
