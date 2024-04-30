<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div>Externe link: {{ policy.name || "Naamloos" }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="$emit('delete')">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
            </div>
        </h2>
        
        <STInputBox title="Naam">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                :placeholder="'bv. Contact'"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Naar waar wijst deze link?" error-fields="privacy" :error-box="errorBox" class="max">
            <RadioGroup>
                <Radio v-model="selectedType" value="website">
                    Naar een website
                </Radio>
                <Radio v-model="selectedType" value="file">
                    Naar een PDF-bestand
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedType == 'website'" key="website" title="Volledige link" error-fields="url" :error-box="errorBox">
            <input
                v-model="url"
                class="input"
                type="url"
                :placeholder="$t('dashboard.inputs.privacyUrl.placeholder')"
            >
        </STInputBox>

        <FileInput v-if="selectedType == 'file'" key="file" v-model="file" title="Kies een bestand" :validator="validator" :required="false" />
    </div>
</template>


<script lang="ts">
import { SimpleError } from "@simonbackx/simple-errors";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox, FileInput,LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Validator} from "@stamhoofd/components";
import { File, Policy } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        BackButton,
        LoadingButton,
        FileInput
    },
})
export default class EditPolicyBox extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    errorBox: ErrorBox | null

    @Prop({ required: true })
    validator: Validator

    @Prop({ required: true })
    policy!: Policy

    selectedType = (this.policy.file ? "file" : "website")

    get name() {
        return this.policy.name
    }

    set name(name: string) {
        this.$emit("patch", Policy.patch({ name }))
    }
    
    get url() {
        return this.policy.url
    }

    set url(url: string | null) {
        this.$emit("patch", Policy.patch({ url }))
    }

    get file() {
        return this.policy.file
    }

    set file(file: File | null) {
        this.$emit("patch", Policy.patch({ file }))
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    validate() {
        // TODO: add validator
        if (this.selectedType == "file") {
            this.url = null;
            // We don't clear the file if url is selected, since url has priority over the file. So we don't need to reupload the file
            if (!this.file) {
                throw new SimpleError({
                    code: "",
                    message: "Selecteer een bestand"
                })
            }
        } else {
            if (!this.url) {
                throw new SimpleError({
                    code: "",
                    message: "Vul een geldige link in"
                })
            }
        }

        if (this.selectedType == "website" && this.policy.url && this.policy.url.length > 0 && !this.policy.url.startsWith("http://") && !this.policy.url.startsWith("https://") && !this.policy.url.startsWith("mailto:") && !this.policy.url.startsWith("tel:")) {
            this.url = "http://"+this.policy.url
        }
        return true
    }
}
</script>
