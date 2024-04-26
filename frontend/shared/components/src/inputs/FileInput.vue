<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label class="file-input-box" :class="{ center: !value }" @click="onClick">
            <Spinner v-if="uploading" />
            <span v-else-if="value == null" class="icon center upload" />

            <span v-if="value" :class="'icon '+getFileIcon(value)" />
            <span v-if="value">{{ value.name }}</span>

            <span v-if="!required && value" class="icon trash" @click="deleteMe" />
            <input type="file" class="file-upload" accept="application/pdf" @change="changedFile">
        </label>
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from "@simonbackx/simple-errors";
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { File } from "@stamhoofd/structures";
import { Component, Mixins,Prop } from "vue-property-decorator";

import Spinner from "../Spinner.vue";

@Component({
    components: {
        Spinner,
        STInputBox
    }
})
export default class FileInput extends Mixins(NavigationMixin) {
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null
    
    @Prop({ default: null })
        value: File | null;

    @Prop({ default: true })
        required!: boolean

    errorBox: ErrorBox | null = null

    uploading = false

    deleteMe() {
        this.$emit("input", null)
    }

    onClick(event) {
        if (this.value) {
            window.open(this.value.getPublicPath(), 'Privacyvoorwaarden')
            event.preventDefault();
        }
    }

    getFileIcon(file: File) {
        if (file.path.endsWith(".png") || file.path.endsWith(".jpg") || file.path.endsWith(".jpeg") || file.path.endsWith(".gif")) {
            return "file-image"
        }
        if (file.path.endsWith(".pdf")) {
            return "file-pdf color-pdf"
        }
        if (file.path.endsWith(".xlsx") || file.path.endsWith(".xls")) {
            return "file-excel color-excel"
        }
        if (file.path.endsWith(".docx") || file.path.endsWith(".doc")) {
            return "file-word color-word"
        }
        return "file"
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

    changedFile(event) {
        if (!event.target.files || event.target.files.length != 1) {
            return;
        }
        if (this.uploading) {
            return;
        }

        const file = event.target.files[0];

        if (file.size > 20 * 1024 * 1024) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'file_too_large',
                message: 'De bestandsgrootte is te groot. Het bestand mag maximaal 20MB groot zijn.'
            }))
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        this.uploading = true;
        this.errorBox = null;

        this.$context.authenticatedServer
            .request({
                method: "POST",
                path: "/upload-file",
                body: formData,
                decoder: File,
                timeout: 60*1000,
                shouldRetry: false,
                owner: this
            })
            .then(response => {
                this.$emit("input", response.data)
            })
            .catch(e => {
                console.error(e);
                this.errorBox = new ErrorBox(e)
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
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.file-input-box {
    @extend .style-input;
    @extend .style-input-shadow;
    border: $border-width solid $color-border;
    color: $color-gray-5;
    background: $color-background;
    border-radius: $border-radius;
    padding: 5px 15px;
    height: 50px;
    margin: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    transition: border-color 0.2s, color 0.2s;
    outline: none;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    cursor: pointer;
    touch-action: manipulation;
    position: relative;

    &.center {
        justify-content: center;
    }


    &:hover {
        border-color: $color-primary-gray-light;
        color: $color-primary;
    }

    &:active {
        border-color: $color-primary;
        color: $color-primary;
    }

    &.square {
        width: 60px;
    }

    .file-upload {
        display: none;
    }

    .icon:first-child {
        margin-right: 10px;

        &+ span {
            color: $color-dark;
        }
    }

    .icon.trash {
        opacity: 0;
        transition: opacity 0.2s;
        margin-left: auto;
        color: $color-error;
       
        &:hover {
            opacity: 1;
        }
    }

    &:hover {
        .icon.trash {
            opacity: 1;
        }
    }
}

</style>
