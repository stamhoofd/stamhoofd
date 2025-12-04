<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>{{ $t('08aa378f-6e1d-4882-965f-756108c677e1') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggablePolicies" :draggable="true">
            <template #item="{item: policy}">
                <PolicyRow :policy="policy" @click="editPolicy(policy)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addPolicy">
                <span class="icon add" />
                <span>{{ $t('23229877-c51f-4e18-8563-88315be182aa') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
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

const title = $t(`e9a19cd1-7a57-440d-a97e-6cff23a7f46c`);

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
        new Toast($t(`17017abf-c2e0-4479-86af-300ad37347aa`), 'success green').show();
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
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
