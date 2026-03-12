<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>{{ $t('%IR') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggablePolicies" :draggable="true">
            <template #item="{item: policy}">
                <PolicyRow :policy="policy" @click="editPolicy(policy)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addPolicy">
                <span class="icon add" />
                <span>{{ $t('%IS') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useDraggableArray } from '@stamhoofd/components/hooks/useDraggableArray.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { Platform, PlatformConfig, PlatformPolicy, PrivacySettings } from '@stamhoofd/structures';
import { ref } from 'vue';
import PolicyRow from './components/PolicyRow.vue';
import EditPolicyView from './EditPolicyView.vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();

const { patched, addPatch, hasChanges, patch } = usePatch(platform.value);
const draggablePolicies = useDraggableArray(() => patched.value.config.privacy.policies, (arr) => {
    addPatch(Platform.patch({
        config: PlatformConfig.patch({
            privacy: PrivacySettings.patch({
                policies: arr,
            }),
        }),
    }));
});
const saving = ref(false);

const title = $t(`%IS`);

async function addPolicy() {
    const privacyPatch = PrivacySettings.patch({});
    const policy = PlatformPolicy.create({});
    privacyPatch.policies.addPut(policy);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditPolicyView, {
                policy,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PlatformPolicy>) => {
                    patch.id = policy.id;
                    privacyPatch.policies.addPatch(patch);
                    addPatch(Platform.patch({
                        config: PlatformConfig.patch({
                            privacy: privacyPatch,
                        }),
                    }));
                },
            }),
        ],
    });
}

async function editPolicy(policy: PlatformPolicy) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditPolicyView, {
                policy,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PlatformPolicy>) => {
                    const privacyPatch = PrivacySettings.patch({});
                    patch.id = policy.id;
                    privacyPatch.policies.addPatch(patch);
                    addPatch(Platform.patch({
                        config: PlatformConfig.patch({
                            privacy: privacyPatch,
                        }),
                    }));
                },
                deleteHandler: () => {
                    const privacyPatch = PrivacySettings.patch({});
                    privacyPatch.policies.addDelete(policy.id);
                    addPatch(Platform.patch({
                        config: PlatformConfig.patch({
                            privacy: privacyPatch,
                        }),
                    }));
                },
            }),
        ],
    });
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await platformManager.value.patch(patch.value);
        new Toast($t(`%HA`), 'success green').show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
