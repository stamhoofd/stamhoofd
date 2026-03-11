<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <template #buttons>
            <button v-tooltip="$t('%A1')" class="button icon add" type="button" @click="addResponsibility" />
        </template>

        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="inheritedResponsibilitiesWithGroup.length">
            <hr>
            <h2>{{ $t('%3n') }}</h2>
            <p>{{ $t('%A2') }}</p>

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
                {{ $t('%A3') }}
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
                <span>{{ $t('%A1') }}</span>
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
        title: $t('%A4'),
        description: $t('%A5'),
        responsibilities: [] as MemberResponsibility[],
    };

    const organizationResponsibiities = {
        id: 'organization',
        title: organization.value ? $t('%109') : $t('%A6'),
        description: organization.value ? $t('%A7') : $t('%A8'),
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

const title = $t('%3p');

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
        new Toast($t('%HA'), 'success green').show();
        await pop({ force: true });
    });
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
