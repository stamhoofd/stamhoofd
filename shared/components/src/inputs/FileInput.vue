<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label class="file-input-box" @click="onClick" :class="{ center: !value }">
            <Spinner v-if="uploading" />
            <span class="icon center upload" v-else-if="value == null"/>

            <span class="icon file" v-if="value" />
            <span v-if="value">{{ value.name }}</span>

            <span class="icon trash" v-if="!required && value" @click="deleteMe"/>
            <input type="file" class="file-upload" accept="application/pdf" @change="changedFile">
        </label>
    </STInputBox>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Formatter } from "@stamhoofd/utility"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { File, ResolutionRequest, Version } from "@stamhoofd/structures";
import Spinner from "../Spinner.vue";
import DateSelectionView from '../overlays/DateSelectionView.vue';
import { SessionManager } from '@stamhoofd/networking';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"

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

    changedFile(event) {
        if (!event.target.files || event.target.files.length != 1) {
            return;
        }
        if (this.uploading) {
            return;
        }

        const file = event.target.files[0];

        const formData = new FormData();
        formData.append("file", file);

        this.uploading = true;
        this.errorBox = null;

        SessionManager.currentSession!.authenticatedServer
            .request({
                method: "POST",
                path: "/upload-file",
                body: formData,
                decoder: File,
                timeout: 60*1000
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
    border: $border-width solid $color-gray-light;
    color: $color-gray;
    background: white;
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

    .icon.file {
        margin-right: 10px;
        color: $color-dark;

        &+ span {
            color: $color-dark;
        }
    }

    .icon.trash {
        opacity: 0;
        transition: opacity 0.2s;
        margin-left: auto;
        color: $color-gray;
       
        &:hover {
            opacity: 1;
            color: $color-error;
        }
    }

    &:hover {
        .icon.trash {
            opacity: 1;
        }
    }
}

</style>
