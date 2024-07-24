<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="inheritedResponsibilitiesWithGroup.length">
            <hr>
            <h2>{{ $t('admin.settings.responsibilities.inherited') }}</h2>
            <p>Ken automatisch rechten toe aan leden die een bepaalde ingebouwde functie hebben.</p>

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
                Geen functies gevonden
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
                <span>Functie toevoegen</span>
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
import { usePatchRoles } from '../admins/hooks/useRoles';
import InheritedResponsibilityRow from './components/InheritedResponsibilityRow.vue';
import ResponsibilityRow from './components/ResponsibilityRow.vue';
import EditResponsibilityView from './EditResponsibilityView.vue';

const pop = usePop();
const present = usePresent();
const $t = useTranslate();
const organization = useOrganization()

const {saving, errors, save: rawSave, hasChanges, createInheritedResponsibilityRolePatchArray, responsibilities, inheritedResponsibilitiesWithGroup, patchResponsibilities, patchInheritedResponsibilityRoles} = usePatchRoles()


const draggableResponsibilities = useDraggableArray(() => responsibilities.value, patchResponsibilities)
const groupedDraggableResponsibilites = computed(() => {
    const nationalResponsibilites = {
        id: 'national',
        title: 'Functies op nationaal niveau',
        description: 'Deze functies zijn globaal en gelden enkel op koepelniveau. Enkel een hoofdbeheerder van de koepel kan deze toekennen aan een lid. Sommige functies geven ook toegang het het administratieportaal.',
        responsibilities: [] as MemberResponsibility[]
    }

    const organizationResponsibiities = {
        id: 'organization',
        title: organization.value ? 'Groepseigenfuncties' : 'Standaardfuncties op lokaal niveau',
        description: organization.value ? 'Voeg eigen functies toe die enkel van toepassing zijn in je eigen groep.' : 'Deze functies worden gekoppeld aan een lid samen met een lokale groep, door een hoofdbeheerder van die groep. Een lokale groep kan zelf ook nog groepseigenfuncties toevoegen om deze uit te breiden.',
        responsibilities: [] as MemberResponsibility[]
    }
    
    const groups = organization.value ? [organizationResponsibiities] : [nationalResponsibilites, organizationResponsibiities]

    for (const responsibility of draggableResponsibilities.value) {
        if (responsibility.organizationBased) {
            organizationResponsibiities.responsibilities.push(responsibility)
        } else {
            nationalResponsibilites.responsibilities.push(responsibility)
        }
    }


    return groups.map(g => {
        return {
            ...g,
            responsibilities: computed({
                get: () => g.responsibilities,
                set: (value: MemberResponsibility[]) => {
                    const allGroups = groups.filter(gg => gg !== g).flatMap(gg => gg.responsibilities);
                    allGroups.push(...value)
                    draggableResponsibilities.value = allGroups
                }
            })
        }
    });
})

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
                    patchResponsibilities(arr)
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
                    patchResponsibilities(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray()
                    arr.addDelete(responsibility.id)
                    patchResponsibilities(arr)
                }
            })
        ]
    })
}

async function editInheritedResponsibility(responsibility: MemberResponsibility, group: Group|null, role: PermissionRoleForResponsibility|null) {
    let isNew = false

    if (!role) {
        role = responsibility.createDefaultPermissions(group)
        isNew = true
    }
    
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRoleView, {
                role,
                inheritedRoles: [responsibility.getPermissions(group?.id ?? null)],
                isNew,
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => {
                    const arr = createInheritedResponsibilityRolePatchArray()
                    if (isNew) {
                        const patched = role.patch(patch);
                        arr.addPut(patched)
                    } else {
                        arr.addPatch(patch)
                    }
                    patchInheritedResponsibilityRoles(arr)

                },
                deleteHandler: isNew ? null : (() => {
                    const arr = createInheritedResponsibilityRolePatchArray()
                    arr.addDelete(role.id)
                    patchInheritedResponsibilityRoles(arr)
                })
            })
        ]
    })
}

async function save() {
    await rawSave(async () => {
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        await pop({ force: true });
    })
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
