<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%l`)" @save="save">
        <h1>
            {{ $t('%l') }}
        </h1>
        <p>
            {{ $t('%OU') }}
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox error-fields="privacy" :error-box="errorBox" class="max" :title="$t(`%OX`)">
            <RadioGroup>
                <Radio v-model="selectedPrivacyType" value="none">
                    {{ $t('%1FW') }}
                </Radio>
                <Radio v-model="selectedPrivacyType" value="website">
                    {{ $t('%OV') }}
                </Radio>
                <Radio v-model="selectedPrivacyType" value="file">
                    {{ $t('%OW') }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedPrivacyType === 'website'" key="website" error-fields="privacyPolicyUrl" :error-box="errorBox" :title="$t(`%OY`)">
            <input v-model="privacyPolicyUrl" class="input" type="url" :placeholder="$t('%2l')">
        </STInputBox>

        <FileInput v-if="selectedPrivacyType === 'file'" key="file" v-model="privacyPolicyFile" :validator="validator" :required="false" :title="$t(`%OZ`)" />
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoder, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import FileInput from '@stamhoofd/components/inputs/FileInput.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import RadioGroup from '@stamhoofd/components/inputs/RadioGroup.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { File } from '@stamhoofd/structures';
import { Organization, OrganizationMetaData, Version } from '@stamhoofd/structures';
import { computed, ref, shallowRef } from 'vue';

type PrivacyType = 'none' | 'file' | 'website';

const baseOrganization = useRequiredOrganization();
const organizationManager = useOrganizationManager();
const dismiss = useDismiss();
const errorBox = ref<ErrorBox | null>(null);
const validator = new Validator();
const saving = ref(false);
const defaultSelectedType: PrivacyType = baseOrganization.value.meta.privacyPolicyUrl ? 'website' : (baseOrganization.value.meta.privacyPolicyFile ? 'file' : 'none');
const selectedPrivacyType = ref<PrivacyType>(defaultSelectedType);
const organizationPatch = shallowRef<AutoEncoderPatchType<Organization> & AutoEncoder>(Organization.patch({ id: baseOrganization.value.id }));
const organization = computed(() => baseOrganization.value.patch(organizationPatch.value));
const privacyPolicyUrl = computed({
    get: () => organization.value.meta.privacyPolicyUrl,
    set: (url: string | null) => {
        organizationPatch.value = organizationPatch.value.patch({
            meta: OrganizationMetaData.patch({
                privacyPolicyUrl: url,
            }),
        });
    },
});
const privacyPolicyFile = computed({
    get: () => organization.value.meta.privacyPolicyFile,
    set: (file: File | null) => {
        organizationPatch.value = organizationPatch.value.patch({
            meta: OrganizationMetaData.patch({
                privacyPolicyFile: file,
            }),
        });
    },
});
const hasChanges = computed(() => selectedPrivacyType.value !== defaultSelectedType || patchContainsChanges(organizationPatch.value, baseOrganization.value, { version: Version }));

async function save() {
    if (saving.value) {
        return;
    }

    const errors = new SimpleErrors();
    if (selectedPrivacyType.value === 'none') {
        privacyPolicyFile.value = null;
        privacyPolicyUrl.value = null;
    } else if (selectedPrivacyType.value === 'file') {
        privacyPolicyUrl.value = null;
    }

    const url = organization.value.meta.privacyPolicyUrl;
    if (selectedPrivacyType.value === 'website' && url && !url.startsWith('http://') && !url.startsWith('https://')) {
        privacyPolicyUrl.value = 'http://' + url;
    }

    errorBox.value = errors.errors.length > 0 ? new ErrorBox(errors) : null;
    if (errors.errors.length > 0 || !await validator.validate()) {
        return;
    }

    saving.value = true;
    try {
        await organizationManager.value.patch(organizationPatch.value);
        organizationPatch.value = Organization.patch({ id: baseOrganization.value.id });
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        await dismiss({ force: true });
    } catch (e) {
        errorBox.value = new ErrorBox(e);
    }
    saving.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({ shouldNavigateAway });
</script>
