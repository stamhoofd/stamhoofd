<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <template #buttons>
            <button v-tooltip="$t('caa4e548-ffa0-4878-a046-c359479423ad')" class="button icon add" type="button" @click="addResponsibility" />
        </template>

        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="inheritedResponsibilitiesWithGroup.length">
            <hr>
            <h2>{{ $t('e55af974-4ce3-4cf2-a56b-d7c8f6fbeaec') }}</h2>
            <p>{{ $t('45f0eefc-1ede-4a64-a811-da151361aec8') }}</p>

            <STList>
                <InheritedResponsibilityRow v-for="{group, responsibility, role} of inheritedResponsibilitiesWithGroup" :key="responsibility.id" :responsibility="responsibility" :group="group" :role="role" @click="editInheritedResponsibility(responsibility, group, role)" />
            </STList>
        </template>

        <div v-for="group of groupedDraggableResponsibilites" :key="group.id" class="container">
            <hr>
            <h2>{{ group.title }}</h2>
            <p v-if="group.description">
                {{ group.description }}
            </p>

            <p v-if="!group.responsibilities.value.length" class="info-box">
                {{ $t('390f755c-b757-4a54-9bb4-d380e5869081') }}
            </p>

            <STList :model-value="group.responsibilities.value" :draggable="true" @update:model-value="group.responsibilities.value = $event;">
                <template #item="{item: responsibility}">
                    <ResponsibilityRow :responsibility="responsibility" @click="editResponsibility(responsibility)" />
                </template>
            </STList>
        </div>

        <p>
            <button class="button text" type="button" @click="addResponsibility">
                <span class="icon add" />
                <span>{{ $t('caa4e548-ffa0-4878-a046-c359479423ad') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Toast, useDraggableArray, useOrganization } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, MemberResponsibility, PermissionRoleForResponsibility } from '@stamhoofd/structures';
import { computed } from 'vue';
import EditRoleView from '../admins/EditRoleView.vue';
import { useReloadAdmins } from '../admins/hooks/useReloadAdmins';
import { usePatchRoles } from '../admins/hooks/useRoles';
import InheritedResponsibilityRow from './components/InheritedResponsibilityRow.vue';
import ResponsibilityRow from './components/ResponsibilityRow.vue';
import EditResponsibilityView from './EditResponsibilityView.vue';

const pop = usePop();
const present = usePresent();

const organization = useOrganization();
const { reloadPromise, reload } = useReloadAdmins();

const { saving, errors, save: rawSave, hasChanges, createInheritedResponsibilityRolePatchArray, responsibilities, inheritedResponsibilitiesWithGroup, patchResponsibilities, patchInheritedResponsibilityRoles } = usePatchRoles();

const draggableResponsibilities = useDraggableArray(() => responsibilities.value, patchResponsibilities);
const groupedDraggableResponsibilites = computed(() => {
    const nationalResponsibilites = {
        id: 'national',
        title: $t('e4f4c4a8-0185-4f84-b5a4-ae58d2b633e3'),
        description: $t('dab378b1-f860-4377-bd0c-04eb2b57af74'),
        responsibilities: [] as MemberResponsibility[],
    };

    const organizationResponsibiities = {
        id: 'organization',
        title: organization.value ? $t('f4fef92e-cb28-408b-ada2-cf8b0da0fbfd') : $t('fcf09121-af79-4d3f-90e7-31dec01ebb98'),
        description: organization.value ? $t('aad47217-df26-43ce-a43c-896697d5fbd4') : $t('e6da382b-6acc-4a77-ab74-ece7ea002d5f'),
        responsibilities: [] as MemberResponsibility[],
    };

    const groups = organization.value ? [organizationResponsibiities] : [nationalResponsibilites, organizationResponsibiities];

    for (const responsibility of draggableResponsibilities.value) {
        if (responsibility.organizationBased) {
            organizationResponsibiities.responsibilities.push(responsibility);
        }
        else {
            nationalResponsibilites.responsibilities.push(responsibility);
        }
    }

    return groups.map((g) => {
        return {
            ...g,
            responsibilities: computed({
                get: () => g.responsibilities,
                set: (value: MemberResponsibility[]) => {
                    const allGroups = groups.filter(gg => gg !== g).flatMap(gg => gg.responsibilities);
                    allGroups.push(...value);
                    draggableResponsibilities.value = allGroups;
                },
            }),
        };
    });
});

const title = $t('e7ba96d7-b233-45c4-8331-d429fcea40a9');

async function addResponsibility() {
    const arr: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();
    const responsibility = MemberResponsibility.create({});
    arr.addPut(responsibility);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResponsibilityView, {
                responsibility,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<MemberResponsibility>) => {
                    patch.id = responsibility.id;
                    arr.addPatch(patch);
                    patchResponsibilities(arr);
                },
            }),
        ],
    });
}

async function editResponsibility(responsibility: MemberResponsibility) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResponsibilityView, {
                responsibility,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<MemberResponsibility>) => {
                    const arr: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();
                    arr.addPatch(patch);
                    patchResponsibilities(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();
                    arr.addDelete(responsibility.id);
                    patchResponsibilities(arr);
                },
            }),
        ],
    });
}

async function editInheritedResponsibility(responsibility: MemberResponsibility, group: Group | null, role: PermissionRoleForResponsibility | null) {
    let isNew = false;

    if (!role) {
        role = responsibility.createDefaultPermissions(group);
        isNew = true;
    }

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRoleView, {
                role,
                inheritedRoles: [responsibility.getPermissions(group?.id ?? null)],
                isNew,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => {
                    const arr = createInheritedResponsibilityRolePatchArray();
                    if (isNew) {
                        const patched = role.patch(patch);
                        arr.addPut(patched);
                    }
                    else {
                        arr.addPatch(patch);
                    }
                    patchInheritedResponsibilityRoles(arr);
                },
                deleteHandler: isNew
                    ? null
                    : () => {
                            const arr = createInheritedResponsibilityRolePatchArray();
                            arr.addDelete(role.id);
                            patchInheritedResponsibilityRoles(arr);
                        },
            }),
        ],
    });
}

async function save() {
    await rawSave(async () => {
        reload();
        await reloadPromise();
        new Toast($t('53a2f29c-ee8c-42da-b49a-c0ce07544b99'), 'success green').show();
        await pop({ force: true });
    });
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
