<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>{{ $t('4bff53d6-7455-45fc-aa6d-ae0bafbe0b47') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableGroups" :draggable="true">
            <template #item="{item: group}">
                <DefaultAgeGroupRow :group="group" @click="editGroup(group)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addGroup">
                <span class="icon add" />
                <span>{{ $t('a4f0a3f5-60a5-4959-800c-613e8c79d6d9') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatchArray, usePlatform } from '@stamhoofd/components';
import { computed, ref } from 'vue';
import EditDefaultAgeGroupView from './EditDefaultAgeGroupView.vue';
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { DefaultAgeGroup, Platform, PlatformConfig } from '@stamhoofd/structures';
import DefaultAgeGroupRow from './components/DefaultAgeGroupRow.vue';
import { usePlatformManager } from '@stamhoofd/networking';
import { useTranslate } from '@stamhoofd/frontend-i18n';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();

const originalGroups = computed(() => platform.value.config.defaultAgeGroups);
const { patched: groups, patch, addArrayPatch, hasChanges } = usePatchArray(originalGroups);
const draggableGroups = useDraggableArray(() => groups.value, addArrayPatch);
const saving = ref(false);

const title = $t('9af957c4-5dea-47ee-a30f-1ef5802a9437');

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
        new Toast($t('f80e230f-9621-439d-b4ba-bc49fb921698'), 'success green').show();
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
