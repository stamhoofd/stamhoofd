<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-page-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox"/>

        <hr><h2 class="style-with-button">
            <div>{{ $t('e4a90efd-a536-472b-8f3f-cbd0fac0ba82') }}</div>
            <div>
                <button v-if="coverPhoto" class="button text only-icon-smartphone" type="button" @click="coverPhoto = null">
                    <span class="icon trash"/>
                    <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`c01d3d4e-ad4e-45ec-abac-431462c194cf`) : $t(`3370bb72-2817-4096-83ce-318993436513`)" :resolutions="hs"/>
            </div>
        </h2>

        <p>{{ $t('745fdf86-28e4-4448-8012-b2959a873b12') }}</p>

        <figure v-if="coverPhotoSrc" class="cover-photo">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight"></figure>

        <hr><h2 class="style-with-button">
            <div>{{ $t('0d984a81-9f69-4ba0-ad93-2706027fe78d') }}</div>
            <div>
                <button v-if="squarePhoto" class="button text only-icon-smartphone" type="button" @click="squarePhoto = null">
                    <span class="icon trash"/>
                    <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                </button>
                <UploadButton v-model="squarePhoto" :text="squarePhoto ? $t(`c01d3d4e-ad4e-45ec-abac-431462c194cf`) : $t(`3370bb72-2817-4096-83ce-318993436513`)" :resolutions="hsSquare"/>
            </div>
        </h2>

        <p>{{ $t('4c3114b0-b806-4da3-a581-f9c2e285bcc8') }}</p>

        <figure v-if="squarePhotoSrc" class="square-photo">
            <img :src="squarePhotoSrc"></figure>
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
        return this.patchedGroup.settings.description;
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
                width: 250
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
