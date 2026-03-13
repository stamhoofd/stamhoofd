<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>{{ $t('%7V') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableGroups" :draggable="true">
            <template #item="{item: group}">
                <DefaultAgeGroupRow :group="group" @click="editGroup(group)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addGroup">
                <span class="icon add" />
                <span>{{ $t('%7W') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useDraggableArray } from '@stamhoofd/components/hooks/useDraggableArray.ts';
import { usePatchArray } from '@stamhoofd/components/hooks/usePatchArray.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { usePlatformManager } from '@stamhoofd/networking';
import { DefaultAgeGroup, Platform, PlatformConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import DefaultAgeGroupRow from './components/DefaultAgeGroupRow.vue';
import EditDefaultAgeGroupView from './EditDefaultAgeGroupView.vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();

const originalGroups = computed(() => platform.value.config.defaultAgeGroups);
const { patched: groups, patch, addArrayPatch, hasChanges } = usePatchArray(originalGroups);
const draggableGroups = useDraggableArray(() => groups.value, addArrayPatch);
const saving = ref(false);

const title = $t('%3M');

async function addGroup() {
    const arr: PatchableArrayAutoEncoder<DefaultAgeGroup> = new PatchableArray();
    const group = DefaultAgeGroup.create({});
    arr.addPut(group);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditDefaultAgeGroupView, {
                group,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<DefaultAgeGroup>) => {
                    patch.id = group.id;
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
            }),
        ],
    });
}

async function editGroup(group: DefaultAgeGroup) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditDefaultAgeGroupView, {
                group,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<DefaultAgeGroup>) => {
                    const arr: PatchableArrayAutoEncoder<DefaultAgeGroup> = new PatchableArray();
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<DefaultAgeGroup> = new PatchableArray();
                    arr.addDelete(group.id);
                    addArrayPatch(arr);
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
        await platformManager.value.patch(Platform.patch({
            config: PlatformConfig.patch({
                defaultAgeGroups: patch.value,
            }),
        }));
        new Toast($t('%HA'), 'success green').show();
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
