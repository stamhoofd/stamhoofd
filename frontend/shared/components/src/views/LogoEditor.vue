<template>
    <div>
        <Checkbox v-if="defaultToOrganization" v-model="useOrg">
            Logo van vereniging gebruiken
        </Checkbox>

        <div v-if="!useOrg || !defaultToOrganization">
            <div v-if="darkMode === 'Off' || darkMode === 'Auto'" class="split-inputs">
                <div>
                    <ImageInput v-model="horizontalLogo" :placeholder="horizontalLogoPlaceholder" title="Horizontaal logo" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" />

                    <p class="style-description-small">
                        Voor grotere schermen.
                    </p>
                </div>

                <div>
                    <ImageInput v-model="squareLogo" :placeholder="squareLogoPlaceholder" title="Vierkant logo" :validator="validator" :resolutions="squareLogoResolutions" :required="false" />
                    <p class="style-description-small">
                        Voor op kleine schermen. Laat tekst zoveel mogelijk weg uit dit logo.
                    </p>
                </div>
            </div>
            <div v-if="darkMode === 'On' || darkMode === 'Auto'" class="split-inputs">
                <div>
                    <ImageInput v-model="horizontalLogoDark" :placeholder="horizontalLogoDarkPlaceholder" title="Horizontaal logo" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" :dark="true" />

                    <p class="style-description-small">
                        Voor grotere schermen. In donkere modus.
                    </p>
                </div>

                <div>
                    <ImageInput v-model="squareLogoDark" :placeholder="squareLogoDarkPlaceholder" title="Vierkant logo" :validator="validator" :resolutions="squareLogoResolutions" :required="false" :dark="true" />
                    <p class="style-description-small">
                        Voor op kleine schermen. In donkere modus. Laat tekst zoveel mogelijk weg uit dit logo.
                    </p>
                </div>
            </div>

            <Checkbox v-model="expandLogo">
                Logo groter weergeven (afgeraden)
            </Checkbox>
        </div>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { DarkMode, Image, OrganizationMetaData, ResolutionFit, ResolutionRequest, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

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
        metaData: WebshopMetaData | OrganizationMetaData
    
    @Prop({ default: null }) 
        validator: Validator | null

    @Prop({ default: false }) 
        defaultToOrganization!: boolean

    @Prop({ default: DarkMode.Off }) 
        darkMode!: DarkMode

    get useOrg() {
        return !((this.metaData as any).useLogo ?? false)
    }

    set useOrg(useOrg: boolean) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData).patch({ useLogo: !useOrg }))
    }

    get squareLogo() {
        return this.metaData.squareLogo
    }

    set squareLogo(image: Image | null) {
        this.$emit('patch', (this.metaData.constructor as typeof WebshopMetaData | typeof OrganizationMetaData).patch({ squareLogo: image }))
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