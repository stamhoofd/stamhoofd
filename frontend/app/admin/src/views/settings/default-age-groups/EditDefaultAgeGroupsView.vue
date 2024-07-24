<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>Elke lokale groep moet per inschrijvingsgroep een standaard leeftijsgroep koppelen. Op die manier kan de benaming van de groep gekoppeld worden aan de algemene benaming van de koepel.</p>
        
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableGroups" :draggable="true">
            <template #item="{item: group}">
                <DefaultAgeGroupRow :group="group" @click="editGroup(group)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addGroup">
                <span class="icon add" />
                <span>Groep toevoegen</span>
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
const $t = useTranslate();

const originalGroups = computed(() => platform.value.config.defaultAgeGroups)
const {patched: groups, patch, addArrayPatch, hasChanges} = usePatchArray(originalGroups)
const draggableGroups = useDraggableArray(() => groups.value, addArrayPatch)
const saving = ref(false);

const title = 'Standaard leeftijdsgroepen'

async function addGroup() {
    const arr: PatchableArrayAutoEncoder<DefaultAgeGroup> = new PatchableArray()
    const group = DefaultAgeGroup.create({});
    arr.addPut(group)

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditDefaultAgeGroupView, {
                group,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<DefaultAgeGroup>) => {
                    patch.id = group.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function editGroup(group: DefaultAgeGroup) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditDefaultAgeGroupView, {
                group,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<DefaultAgeGroup>) => {
                    const arr: PatchableArrayAutoEncoder<DefaultAgeGroup> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<DefaultAgeGroup> = new PatchableArray()
                    arr.addDelete(group.id)
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
                defaultAgeGroups: patch.value
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
