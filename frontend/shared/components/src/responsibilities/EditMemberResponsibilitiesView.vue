<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="inheritedResponsibilities.length">
            <hr>
            <h2>{{ $t('admin.settings.responsibilities.inherited') }}</h2>
            <p>Ken automatisch rechten toe aan leden die een bepaalde ingebouwde functie hebben.</p>

            <STList>
                <ResponsibilityRow v-for="responsibility of inheritedResponsibilities" :key="responsibility.id" :responsibility="responsibility" @click="editResponsibility(responsibility)" />
            </STList>

        </template>

        <template v-if="inheritedResponsibilities.length">
            <hr>
            <h2>{{ $t('admin.settings.responsibilities.ownTitle') }}</h2>
        </template>

        <STList v-model="draggableResponsibilities" :draggable="true">
            <template #item="{item: responsibility}">
                <ResponsibilityRow :responsibility="responsibility" @click="editResponsibility(responsibility)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addResponsibility">
                <span class="icon add" />
                <span>Functie toevoegen</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, useOrganization, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useOrganizationManager, usePlatformManager } from '@stamhoofd/networking';
import { MemberResponsibility, Organization, OrganizationPrivateMetaData, Platform, PlatformConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import ResponsibilityRow from './components/ResponsibilityRow.vue';
import EditResponsibilityView from './EditResponsibilityView.vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const present = usePresent();
const $t = useTranslate();
const organization = useOrganization()
const organizationManager = useOrganizationManager()

const originalResponsibilities = computed(() => organization.value ? (organization.value.privateMeta?.responsibilities ?? []) : platform.value.config.responsibilities)
const inheritedResponsibilities = computed(() => organization.value  ? platform.value.config.responsibilities : [])

const {patched: responsibilities, patch, addArrayPatch, hasChanges} = usePatchArray(originalResponsibilities)
const draggableResponsibilities = useDraggableArray(() => responsibilities.value, addArrayPatch)
const saving = ref(false);

const title = $t('admin.settings.responsibilities.title')

async function addResponsibility() {
    const arr: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray()
    const responsibility = MemberResponsibility.create({});
    arr.addPut(responsibility)

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResponsibilityView, {
                responsibility,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<MemberResponsibility>) => {
                    patch.id = responsibility.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function editResponsibility(responsibility: MemberResponsibility) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResponsibilityView, {
                responsibility,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<MemberResponsibility>) => {
                    const arr: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray()
                    arr.addDelete(responsibility.id)
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
        if (organization.value) {
            await organizationManager.value.patch(
                Organization.patch({
                    privateMeta: OrganizationPrivateMetaData.patch({
                        responsibilities: patch.value
                    })
                })
            )
        } else {
            await platformManager.value.patch(Platform.patch({
                config: PlatformConfig.patch({
                    responsibilities: patch.value
                })
            }))
        }

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
