<template>
    <label class="upload-button">
        <LoadingButton :loading="uploading">
            <slot>
                <div class="button text" type="button">
                    <span class="icon upload" />
                    <span>{{ text || "Foto uploaden" }}</span>
                </div>
            </slot>
        </LoadingButton>
        <input type="file" class="file-upload" accept="image/png, image/jpeg, image/svg+xml" @change="changedFile">
    </label>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Formatter } from "@stamhoofd/utility"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { Image, ResolutionRequest, Version } from "@stamhoofd/structures";
import LoadingButton from "../navigation/LoadingButton.vue";
import DateSelectionView from '../overlays/DateSelectionView.vue';
import { SessionManager } from '@stamhoofd/networking';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"

@Component({
    components: {
        STInputBox,
        LoadingButton
    }
})
export default class UploadButton extends Mixins(NavigationMixin) {
    @Prop({ default: "" }) 
    text: string;

    @Prop({ default: null }) 
    validator: Validator | null

    @Prop({ default: null })
    resolutions: ResolutionRequest[] | null
    
    @Prop({ default: null })
    value: Image | null;

    uploading = false

    changedFile(event) {
        if (!event.target.files || event.target.files.length != 1) {
            return;
        }
        if (this.uploading) {
            return;
        }

        const file = event.target.files[0];
        const resolutions = this.resolutions ?? [ResolutionRequest.create({ height: 720 })]

        const formData = new FormData();
        formData.append("file", file);
        formData.append("resolutions", JSON.stringify(resolutions.map(r => r.encode({ version: Version }))))

        this.uploading = true;
        //this.errorBox = null;

        SessionManager.currentSession!.authenticatedServer
            .request({
                method: "POST",
                path: "/upload-image",
                body: formData,
                decoder: Image,
                timeout: 60*1000
            })
            .then(response => {
                this.$emit("input", response.data)
            })
            .catch(e => {
                console.error(e);
                //this.errorBox = new ErrorBox(e)
                // todo!
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

.upload-button {
    .file-upload {
        display: none;
    }
}

</style>
