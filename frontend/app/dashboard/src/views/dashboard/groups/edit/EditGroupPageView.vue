<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-page-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Beschrijving" error-fields="settings.description" :error-box="errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Zichtbaar voor leden tijdens het inschrijven"
                autocomplete=""
            />
        </STInputBox>

        <STInputBox title="Locatie" error-fields="settings.location" :error-box="errorBox">
            <input
                v-model="location"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete=""
            >
        </STInputBox>

        <hr>
        <h2 class="style-with-button">
            <div>Omslagfoto</div>
            <div>
                <button v-if="coverPhoto" class="button text only-icon-smartphone" type="button" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Uploaden'" :resolutions="hs" />
            </div>
        </h2>

        <p>Deze foto wordt getoond met een grootte van 1800 x 750 pixels, bovenaan de informatiepagina van deze groep.</p>

        <figure v-if="coverPhotoSrc" class="cover-photo">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>

        <hr>
        <h2 class="style-with-button">
            <div>Vierkante foto</div>
            <div>
                <button v-if="squarePhoto" class="button text only-icon-smartphone" type="button" @click="squarePhoto = null">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <UploadButton v-model="squarePhoto" :text="squarePhoto ? 'Vervangen' : 'Uploaden'" :resolutions="hsSquare" />
            </div>
        </h2>

        <p>Deze foto wordt getoond in het overzicht bij de keuze tussen alle groepen. Upload bij voorkeur een foto groter dan 200 x 200 pixels. Als je deze niet uploadt gebruiken we gewoon de omslagfoto (als die er is). Je hoeft dus niet dezelfde foto nog eens te uploaden.</p>

        <figure v-if="squarePhotoSrc" class="square-photo">
            <img :src="squarePhotoSrc">
        </figure>
    </SaveView>
</template>

<script lang="ts">
import { SaveView, STErrorsDefault, STInputBox, STList, STListItem, UploadButton } from "@stamhoofd/components";
import { GroupSettings, Image, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        UploadButton,
        STListItem
    },
})
export default class EditGroupPageView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Bijkomende informatie'
    }

    get location() {
        return this.patchedGroup.settings.location
    }

    set location(location: string) {
        this.addSettingsPatch({ location })
    }

    get description() {
        return this.patchedGroup.settings.description
    }

    set description(description: string) {
        this.addSettingsPatch({ description })
    }

    get coverPhoto() {
        return this.patchedGroup.settings.coverPhoto
    }

    set coverPhoto(coverPhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            coverPhoto
        }))
    }

    get hs() {
        return [
            ResolutionRequest.create({
                width: 1600
            }),
            ResolutionRequest.create({
                width: 800
            }),
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover
            })
        ]
    }

    get coverPhotoResolution() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return image.getResolutionForSize(800, 200)
    }

    get coverPhotoSrc() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return this.coverPhotoResolution?.file.getPublicPath()
    }
    
    get coverImageWidth() {
        return this.coverPhotoResolution?.width
    }

    get coverImageHeight() {
        return this.coverPhotoResolution?.height
    }

    // Cover picture
    get squarePhoto() {
        return this.patchedGroup.settings.squarePhoto
    }

    set squarePhoto(squarePhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            squarePhoto
        }))
    }

    get hsSquare() {
        return [
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover
            })
        ]
    }

    get squarePhotoSrc() {
        const image = this.squarePhoto
        if (!image) {
            return null
        }
        return image.getResolutionForSize(250, 250).file.getPublicPath()
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-edit-page-view {
    .cover-photo {
        height: 0;
        position: relative;
        padding-bottom: calc(750 / 1800 * 100%);
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-top: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
            position: absolute;
            left: 0;
            top: 0;
        }
    }

    .square-photo {
        img {
            height: 200px;
            width: 200px;
            border-radius: $border-radius;
            object-fit: contain;
        }
    }

}
</style>
