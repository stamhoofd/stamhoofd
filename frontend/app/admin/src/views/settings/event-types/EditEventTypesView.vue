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
                <span>{{ $t('Nieuwe soort activiteit') }}</span>
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
const $t = useTranslate();
const platform = usePlatform();
const platformManager = usePlatformManager()

const originalTypes = computed(() => platform.value.config.eventTypes)
const {patched: types, patch, addArrayPatch, hasChanges} = usePatchArray(originalTypes)
const draggableTypes = useDraggableArray(() => types.value, addArrayPatch)

const saving = ref(false);

const title = $t('Soorten activiteiten')

async function addType() {
    const arr: PatchableArrayAutoEncoder<PlatformEventType> = new PatchableArray()
    const type = PlatformEventType.create({})
    arr.addPut(type)

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventTypeView, {
                type,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PlatformEventType>) => {
                    patch.id = type.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function editType(type: PlatformEventType) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventTypeView, {
                type,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PlatformEventType>) => {
                    const arr: PatchableArrayAutoEncoder<PlatformEventType> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<PlatformEventType> = new PatchableArray()
                    arr.addDelete(type.id)
                    addArrayPatch(arr)
                }
            })
        ]
    })
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
                eventTypes: patch.value
            })
        }))
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;

}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})
</script>
