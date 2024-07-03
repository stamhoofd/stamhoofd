<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableTypes" :draggable="true">
            <template #item="{item: type}">
                <MembershipTypeRow :type="type" @click="editType(type)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addType">
                <span class="icon add" />
                <span>{{ $t('admin.settings.membershipTypes.add') }}</span>
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
import { MembershipType, Platform, PlatformConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import MembershipTypeRow from './components/MembershipTypeRow.vue';
import EditMembershipTypeView from './EditMembershipTypeView.vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();
const $t = useTranslate();

const originalTypes = computed(() => platform.value.config.membershipTypes)
const {patched: types, patch, addArrayPatch, hasChanges} = usePatchArray(originalTypes)
const draggableTypes = useDraggableArray(() => types.value, addArrayPatch)
const saving = ref(false);

const title = $t('admin.settings.membershipTypes.title')

async function addType() {
    const arr: PatchableArrayAutoEncoder<MembershipType> = new PatchableArray()
    const type = MembershipType.create({});
    arr.addPut(type)

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditMembershipTypeView, {
                type,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<MembershipType>) => {
                    patch.id = type.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function editType(type: MembershipType) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditMembershipTypeView, {
                type,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<MembershipType>) => {
                    const arr: PatchableArrayAutoEncoder<MembershipType> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<MembershipType> = new PatchableArray()
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
                membershipTypes: patch.value
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
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>
