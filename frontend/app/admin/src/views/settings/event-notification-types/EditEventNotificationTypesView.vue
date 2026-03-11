<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>
            {{ description }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableTypes" :draggable="true">
            <template #item="{item: type}">
                <EventNotificationTypeRow :type="type" @click="editType(type)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addType">
                <span class="icon add" />
                <span>{{ $t('%8l') }}</span>
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
import { Platform, PlatformConfig, EventNotificationType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EditEventNotificationTypeView from './EditEventNotificationTypeView.vue';
import EventNotificationTypeRow from './components/EventNotificationTypeRow.vue';

const errors = useErrors();
const pop = usePop();
const present = usePresent();

const platform = usePlatform();
const platformManager = usePlatformManager();

const originalTypes = computed(() => platform.value.config.eventNotificationTypes);
const { patched: types, patch, addArrayPatch, hasChanges } = usePatchArray(originalTypes);
const draggableTypes = useDraggableArray(() => types.value, addArrayPatch);

const saving = ref(false);

const title = $t('%8m');
const description = $t('%8n');

async function addType() {
    const arr: PatchableArrayAutoEncoder<EventNotificationType> = new PatchableArray();
    const type = EventNotificationType.create({});
    arr.addPut(type);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventNotificationTypeView, {
                type,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<EventNotificationType>) => {
                    patch.id = type.id;
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
            }),
        ],
    });
}

async function editType(type: EventNotificationType) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventNotificationTypeView, {
                type,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<EventNotificationType>) => {
                    const arr: PatchableArrayAutoEncoder<EventNotificationType> = new PatchableArray();
                    arr.addPatch(patch);
                    addArrayPatch(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<EventNotificationType> = new PatchableArray();
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
                eventNotificationTypes: patch.value,
            }),
        }));
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
