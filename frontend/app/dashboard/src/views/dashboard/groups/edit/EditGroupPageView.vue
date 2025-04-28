<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-page-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <hr><h2 class="style-with-button">
            <div>{{ $t('b8a111c0-5f3d-480b-833a-6d7f05bf134d') }}</div>
            <div>
                <button v-if="coverPhoto" class="button text only-icon-smartphone" type="button" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="hs" />
            </div>
        </h2>

        <p>{{ $t('28ebd74a-fd45-4987-9578-87438fbff67d') }}</p>

        <figure v-if="coverPhotoSrc" class="cover-photo">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>

        <hr><h2 class="style-with-button">
            <div>{{ $t('fadb7758-81af-40e4-b448-fadf336595b8') }}</div>
            <div>
                <button v-if="squarePhoto" class="button text only-icon-smartphone" type="button" @click="squarePhoto = null">
                    <span class="icon trash" />
                    <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                </button>
                <UploadButton v-model="squarePhoto" :text="squarePhoto ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="hsSquare" />
            </div>
        </h2>

        <p>{{ $t('4a78fcf6-2564-4846-b828-9eb03c06e0e2') }}</p>

        <figure v-if="squarePhotoSrc" class="square-photo">
            <img :src="squarePhotoSrc">
        </figure>
    </SaveView>
</template>

<script lang="ts">
import { SaveView, STErrorsDefault, STInputBox, STList, STListItem, UploadButton } from '@stamhoofd/components';
import { GroupSettings, Image, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';

import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        UploadButton,
        STListItem,
    },
})
export default class EditGroupPageView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Bijkomende informatie';
    }

    get location() {
        return this.patchedGroup.settings.location;
    }

    set location(location: string) {
        this.addSettingsPatch({ location });
    }

    get description() {
        return this.patchedGroup.settings.description.toString();
    }

    set description(description: string) {
        this.addSettingsPatch({ description });
    }

    get coverPhoto() {
        return this.patchedGroup.settings.coverPhoto;
    }

    set coverPhoto(coverPhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            coverPhoto,
        }));
    }

    get hs() {
        return [
            ResolutionRequest.create({
                width: 1600,
            }),
            ResolutionRequest.create({
                width: 800,
            }),
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover,
            }),
        ];
    }

    get coverPhotoResolution() {
        const image = this.coverPhoto;
        if (!image) {
            return null;
        }
        return image.getResolutionForSize(800, 200);
    }

    get coverPhotoSrc() {
        const image = this.coverPhoto;
        if (!image) {
            return null;
        }
        return this.coverPhotoResolution?.file.getPublicPath();
    }

    get coverImageWidth() {
        return this.coverPhotoResolution?.width;
    }

    get coverImageHeight() {
        return this.coverPhotoResolution?.height;
    }

    // Cover picture
    get squarePhoto() {
        return this.patchedGroup.settings.squarePhoto;
    }

    set squarePhoto(squarePhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            squarePhoto,
        }));
    }

    get hsSquare() {
        return [
            ResolutionRequest.create({
                width: 250,
            }),
        ];
    }

    get squarePhotoSrc() {
        const image = this.squarePhoto;
        if (!image) {
            return null;
        }
        return image.getResolutionForSize(250, 250).file.getPublicPath();
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
