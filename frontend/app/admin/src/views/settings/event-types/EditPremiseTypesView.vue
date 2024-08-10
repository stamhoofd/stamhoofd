<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableTypes" :draggable="true">
            <template #item="{item: type}">
                <PremiseTypeRow :type="type" @click="editType(type)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addType">
                <span class="icon add" />
                <span>{{ $t('Nieuw soort gebouw') }}</span>
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
import { Platform, PlatformConfig, PlatformPremiseType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EditBuildingTypeView from './EditPremiseTypeView.vue';
import PremiseTypeRow from './components/PremiseTypeRow.vue';

const errors = useErrors();
const pop = usePop();
const present = usePresent();
const $t = useTranslate();
const platform = usePlatform();
const platformManager = usePlatformManager()

const originalTypes = computed(() => platform.value.config.premiseTypes)
const {patched: types, patch, addArrayPatch, hasChanges} = usePatchArray(originalTypes)
const draggableTypes = useDraggableArray(() => types.value, addArrayPatch)

const saving = ref(false);

const title = $t('Soorten gebouwen')

async function addType() {
    const arr: PatchableArrayAutoEncoder<PlatformPremiseType> = new PatchableArray()
    const type = PlatformPremiseType.create({})
    arr.addPut(type)

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditBuildingTypeView, {
                type,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PlatformPremiseType>) => {
                    patch.id = type.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function editType(type: PlatformPremiseType) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditBuildingTypeView, {
                type,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PlatformPremiseType>) => {
                    const arr: PatchableArrayAutoEncoder<PlatformPremiseType> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<PlatformPremiseType> = new PatchableArray()
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
        await platformManager.value.patch(Platform.patch({
            config: PlatformConfig.patch({
                premiseTypes: patch.value
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
