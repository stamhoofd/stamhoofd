<template>
    <component :is="elementName" class="upload-button">
        <LoadingButton :loading="uploading">
            <slot>
                <div class="button text only-icon-smartphone">
                    <span class="icon attachment" />
                    <span>{{ text || "Uploaden" }}</span>
                </div>
            </slot>
        </LoadingButton>
        <input type="file" class="file-upload" :accept="accept" @change="changedFile">
    </component>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { File } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import LoadingButton from '../navigation/LoadingButton.vue';
import { Toast } from '../overlays/Toast';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
        LoadingButton,
    },
})
export default class UploadFileButton extends Mixins(NavigationMixin) {
    @Prop({ default: 'label' })
    elementName!: string;

    @Prop({ default: '' })
    text: string;

    @Prop({ default: '' })
    accept: string;

    @Prop({ default: false })
    isPrivate: boolean;

    @Prop({ default: 20 * 1024 * 1024 })
    maxSize: number;

    uploading = false;

    beforeUnmount() {
        Request.cancelAll(this);
    }

    changedFile(event) {
        if (!event.target.files || event.target.files.length !== 1) {
            return;
        }
        if (this.uploading) {
            return;
        }
        Request.cancelAll(this);

        const file = event.target.files[0];

        if (file.size > this.maxSize) {
            const error = new SimpleError({
                code: 'file_too_large',
                message: $t(`97f9599f-cfdd-4705-a94e-8ec6351e99d4`),
            });
            Toast.fromError(error).setHide(null).show();
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        this.uploading = true;
        // this.errorBox = null;

        this.$context.authenticatedServer
            .request({
                method: 'POST',
                path: '/upload-file',
                body: formData,
                decoder: File as Decoder<File>,
                timeout: 5 * 60 * 1000,
                shouldRetry: false,
                owner: this,
                query: {
                    private: this.isPrivate ? true : undefined,
                },
            })
            .then((response) => {
                this.$emit('change', response.data);
            })
            .catch((e) => {
                console.error(e);
                Toast.fromError(e).setHide(null).show();
            })
            .finally(() => {
                this.uploading = false;

                // Clear selection
                event.target.value = null;
            });
    }
}
</script>

<style lang="scss">

.upload-button {
    .file-upload {
        display: none;
    }

    .loading-button {
        display: block;
    }
}

</style>
