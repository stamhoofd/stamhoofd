<template>
    <SaveView :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`Privacy`)">
        <h1>
            {{ $t('6add5b49-34e7-4a45-8e70-e93e82d0942d') }}
        </h1>
        <p>
            {{ $t('440a1dee-2015-48b3-b032-1a4af140f78b') }}
        </p>

        <STErrorsDefault :error-box="errorBox"/>

        <STInputBox error-fields="privacy" :error-box="errorBox" class="max" :title="$t(`48763e30-913b-4e0a-bf9a-eae8689cb8f1`)">
            <RadioGroup>
                <Radio v-model="selectedPrivacyType" value="none">
                    {{ $t('039ea891-15aa-42d4-8513-7f29d0743514') }}
                </Radio>
                <Radio v-model="selectedPrivacyType" value="website">
                    {{ $t('eb806d92-b506-4d8e-aa49-8127f0353b9a') }}
                </Radio>
                <Radio v-model="selectedPrivacyType" value="file">
                    {{ $t('33e194d8-df49-475d-94c0-68c2ff7df5d8') }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedPrivacyType === 'website'" key="website" error-fields="privacyPolicyUrl" :error-box="errorBox" :title="$t(`87a52217-614d-4391-8eb2-357857ee4634`)">
            <input v-model="privacyPolicyUrl" class="input" type="url" :placeholder="$t('daf8a992-77cd-4c20-8bca-5c692fd1e431')"></STInputBox>

        <FileInput v-if="selectedPrivacyType === 'file'" key="file" v-model="privacyPolicyFile" :validator="validator" :required="false" :title="$t(`6ef890af-c906-448d-9e38-a65643a0501e`)"/>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, ErrorBox, FileInput, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, Toast, Validator } from '@stamhoofd/components';
import { File, Organization, OrganizationMetaData, OrganizationPatch, Version } from '@stamhoofd/structures';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        FileInput,
    },
})
export default class PrivacySettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;

    // Keep track of selected option
    defaultSelectedType = 'none';
    selectedPrivacyType = 'none';

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({});

    get organization() {
        return this.$organization.patch(this.organizationPatch);
    }

    get privacyPolicyUrl() {
        return this.organization.meta.privacyPolicyUrl;
    }

    set privacyPolicyUrl(url: string | null) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                privacyPolicyUrl: url,
            }),
        });
    }

    get privacyPolicyFile() {
        return this.organization.meta.privacyPolicyFile;
    }

    set privacyPolicyFile(file: File | null) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                privacyPolicyFile: file,
            }),
        });
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors();

        if (this.selectedPrivacyType === 'none') {
            this.privacyPolicyFile = null;
            this.privacyPolicyUrl = null;
        }
        else if (this.selectedPrivacyType === 'file') {
            this.privacyPolicyUrl = null;
            // We don't clear the file if url is selected, since url has priority over the file. So we don't need to reupload the file
        }

        if (this.selectedPrivacyType === 'website' && this.organization.meta.privacyPolicyUrl && this.organization.meta.privacyPolicyUrl.length > 0 && !this.organization.meta.privacyPolicyUrl.startsWith('http://') && !this.organization.meta.privacyPolicyUrl.startsWith('https://')) {
            this.privacyPolicyUrl = 'http://' + this.organization.meta.privacyPolicyUrl;
        }

        let valid = false;

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
            valid = true;
        }
        valid = valid && await this.validator.validate();

        if (!valid) {
            return;
        }

        this.saving = true;

        try {
            await this.$organizationManager.patch(this.organizationPatch);
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id });
            new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
            this.dismiss({ force: true });
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }

        this.saving = false;
    }

    get hasChanges() {
        return this.selectedPrivacyType !== this.defaultSelectedType || patchContainsChanges(this.organizationPatch, this.$organization, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }

    mounted() {
        this.defaultSelectedType = this.$organization.meta.privacyPolicyUrl ? 'website' : (this.$organization.meta.privacyPolicyFile ? 'file' : 'none');
        this.selectedPrivacyType = this.defaultSelectedType;

        this.organizationPatch.id = this.$organization.id;
        this.setUrl('/privacy');
    }
}
</script>
