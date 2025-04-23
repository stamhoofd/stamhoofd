<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`Privacy`)" @save="save">
        <h1>
            {{ $t('9ce28983-01ef-44bc-bc02-b76575bda1ce') }}
        </h1>
        <p>
            {{ $t('ec02ca17-cd7e-4416-b22f-b63aef41be2a') }}
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox error-fields="privacy" :error-box="errorBox" class="max" :title="$t(`0ea39adf-90dc-43bd-aa66-c95cf1a42cf1`)">
            <RadioGroup>
                <Radio v-model="selectedPrivacyType" value="none">
                    {{ $t('45ff02db-f404-4d91-853f-738d55c40cb6') }}
                </Radio>
                <Radio v-model="selectedPrivacyType" value="website">
                    {{ $t('321a898b-ec70-44e3-a511-f2353061cd66') }}
                </Radio>
                <Radio v-model="selectedPrivacyType" value="file">
                    {{ $t('a10aa0f7-592b-434c-bebe-2974943c392c') }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedPrivacyType === 'website'" key="website" error-fields="privacyPolicyUrl" :error-box="errorBox" :title="$t(`0eacaeba-c809-40fb-823d-af2d283d22e3`)">
            <input v-model="privacyPolicyUrl" class="input" type="url" :placeholder="$t('daf8a992-77cd-4c20-8bca-5c692fd1e431')">
        </STInputBox>

        <FileInput v-if="selectedPrivacyType === 'file'" key="file" v-model="privacyPolicyFile" :validator="validator" :required="false" :title="$t(`2e45c772-02e9-431d-8273-79b3d10b0638`)" />
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
