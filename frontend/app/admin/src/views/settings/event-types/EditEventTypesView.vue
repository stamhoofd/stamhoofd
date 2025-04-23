<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableTypes" :draggable="true">
            <template #item="{item: type}">
                <EventTypeRow :type="type" @click="editType(type)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addType">
                <span class="icon add" />
                <span>{{ $t('9b76d069-ba68-4909-a084-ba74994c8b56') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { Platform, PlatformConfig, PlatformEventType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EditEventTypeView from './EditEventTypeView.vue';
import EventTypeRow from './components/EventTypeRow.vue';

const errors = useErrors();
const pop = usePop();
const present = usePresent();

const platform = usePlatform();
const platformManager = usePlatformManager();

const originalTypes = computed(() => platform.value.config.eventTypes);
const { patched: types, patch, addArrayPatch, hasChanges } = usePatchArray(originalTypes);
const draggableTypes = useDraggableArray(() => types.value, addArrayPatch);

const saving = ref(false);

const title = $t('de211760-1306-4108-92e3-9301435d8988');

async function addType() {
    const arr: PatchableArrayAutoEncoder<PlatformEventType> = new PatchableArray();
    const type = PlatformEventType.create({});
    arr.addPut(type);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventTypeView, {
                type,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PlatformEventType>) => {
                    patch.id = type.id;
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
            }),
        ],
    });
}

async function editType(type: PlatformEventType) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventTypeView, {
                type,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PlatformEventType>) => {
                    const arr: PatchableArrayAutoEncoder<PlatformEventType> = new PatchableArray();
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<PlatformEventType> = new PatchableArray();
                    arr.addDelete(type.id);
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
                eventTypes: patch.value,
            }),
        }));
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
