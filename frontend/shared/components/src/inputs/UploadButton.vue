<template>
    <label class="upload-button">
        <LoadingButton :loading="uploading">
            <slot>
                <div class="button text only-icon-smartphone" type="button">
                    <span class="icon camera-line" />
                    <span>{{ text || "Uploaden" }}</span>
                </div>
            </slot>
        </LoadingButton>
        <input type="file" class="file-upload" accept="image/png, image/jpeg, image/svg+xml" @change="changedFile">
    </label>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { STInputBox, Validator } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Image, ResolutionRequest, Version } from "@stamhoofd/structures";
import { Component, Mixins,Prop } from "vue-property-decorator";

import LoadingButton from "../navigation/LoadingButton.vue";

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

.upload-button {
    .file-upload {
        display: none;
    }
}

</style>
