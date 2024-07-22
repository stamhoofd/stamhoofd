<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title" />

        <ScrollableSegmentedControl v-if="!organization && items.length" v-model="selectedOrganization" :items="items" :labels="labels" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="groupsWithResponsibilites.length === 0" class="info-box">
            Geen functies gevonden
        </p>

        <div v-for="({title, responsibilities}, index) of groupsWithResponsibilites" :key="''+index" class="container">
            <hr v-if="index > 0 || !(!organization && items.length)">
            <h2 v-if="title && groupsWithResponsibilites.length > 1">
                {{ title }}
            </h2>

            <STList>
                <STListItem v-for="{responsibility, group} of responsibilities" :key="responsibility.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox :model-value="isResponsibilityEnabled(responsibility, group?.id)" @update:model-value="setResponsibilityEnabled(responsibility, group?.id, $event)" />
                    </template>

                    <h2 class="style-title-list">
                        {{ responsibility.name }}<template v-if="group">
                            van {{ group.settings.name }}
                        </template>
                    </h2>
                    <p v-if="group && selectedOrganization && group.periodId === selectedOrganization?.period.period.id" class="style-description-small">
                        {{ selectedOrganization.period.period.nameShort }}
                    </p>
                    <p v-else-if="group" class="style-description-small">
                        Onbekend werkjaar
                    </p>

                    <p class="style-description-small">
                        Rechten: {{ getResponsibilityMergedRoleDescription(responsibility, group?.id) }}
                    </p>

                    

                    <p v-if="getResponsibilityEnabledDescription(responsibility, group?.id)" class="style-description-small">
                        {{ getResponsibilityEnabledDescription(responsibility, group?.id) }}
                    </p>
                    <p class="style-description-small">
                        {{ responsibility.description }}
                    </p>

                    <template #right>
                        <span v-if="getResponsibilityMergedRole(responsibility, group?.id).isEmpty" v-tooltip="'Heeft geen automatische rechten'" class="icon layered">
                            <span class="icon user-blocked-layer-1" />
                            <span class="icon user-blocked-layer-2 red" />
                        </span>
                        <span v-else-if="getResponsibilityMergedRole(responsibility, group?.id).hasAccess(PermissionLevel.Full)" class="icon layered">
                            <span class="icon user-admin-layer-1" />
                            <span class="icon user-admin-layer-2 yellow" />
                        </span>
                        <span v-else class="icon user" />
                    </template>
                </STListItem>
            </STList>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Group, LoadedPermissions, MemberResponsibility, MemberResponsibilityRecord, Organization, PlatformMember, PermissionLevel } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ScrollableSegmentedControl, useOrganization, usePlatform } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null
}>()

const errors = useErrors({validator: props.validator});
const platform = usePlatform();
const organization = useOrganization();

const items = computed(() => {
    if (organization.value) {
        return [organization.value]
    }
    // Only show organization that have an active registration in the organization active period
    return [...props.member.filterOrganizations({currentPeriod: true}), null]
});

const platformResponsibilities = computed(() => {
    if (selectedOrganization.value === null) {
        return platform.value.config.responsibilities.filter(r => !r.organizationBased)
    }
    const org = selectedOrganization.value
    return platform.value.config.responsibilities.filter(r => r.organizationBased && (r.organizationTagIds === null || org.meta.matchTags(r.organizationTagIds)))
})

const selectedOrganization = ref((items.value[0] ?? null) as any) as Ref<Organization|null>;

const organizationResponsibilities = computed(() => {
    return selectedOrganization.value?.privateMeta?.responsibilities ?? []
})

const groupsWithResponsibilites = computed(() => {
    const groupedPlatformResponsibilities: {responsibility: MemberResponsibility, group: Group|null}[] = []
    const groupedOrganizationResponsibilities: {responsibility: MemberResponsibility, group: Group|null}[] = []
    const organizationGroups = selectedOrganization.value?.period.adminCategoryTree.getAllGroups() ?? []

    for (const responsibility of platformResponsibilities.value) {
        if (responsibility.defaultAgeGroupIds === null) {
            groupedPlatformResponsibilities.push({
                responsibility: responsibility,
                group: null
            })
        }

        for (const group of organizationGroups) {
            if (group.defaultAgeGroupId && responsibility.defaultAgeGroupIds !== null && responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                groupedPlatformResponsibilities.push({
                    responsibility: responsibility,
                    group: group
                })
            }
        }
    }

    for (const responsibility of organizationResponsibilities.value) {
        if (responsibility.defaultAgeGroupIds === null) {
            groupedOrganizationResponsibilities.push({
                responsibility: responsibility,
                group: null
            })
            continue;
        }
    }
    
    // Merge non-empty groups
    const groups: {title: string, responsibilities: {responsibility: MemberResponsibility, group: Group|null}[]}[] = []

    if (groupedPlatformResponsibilities.length > 0) {
        groups.push({
            title: selectedOrganization.value === null ? '' : 'Standaardfuncties',
            responsibilities: groupedPlatformResponsibilities
        })
    }

    if (groupedOrganizationResponsibilities.length > 0) {
        groups.push({
            title: 'Groepseigenfuncties',
            responsibilities: groupedOrganizationResponsibilities
        })
    }

    return groups;
})

const labels = computed(() => {
    return items.value.map(o => o === null ? 'Nationaal niveau' : o.name)
});

const title = computed(() => {
    return "Functies van " + props.member.patchedMember.firstName
})

useValidation(errors.validator, () => {
    const se = new SimpleErrors()

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se)
        return false
    }
    errors.errorBox = null

    return true
});


function isResponsibilityEnabled(responsibility: MemberResponsibility, groupId?: string|null) {
    return !!props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null))
}

function getResponsibilityEnabledDescription(responsibility: MemberResponsibility, groupId?: string|null) {
    const rr = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null))

    if (rr) {
        if (!rr.endDate) {
            return 'Van ' + Formatter.date(rr.startDate, true) + ' tot nu'
        }
        return 'Van ' + Formatter.date(rr.startDate, true) + ' tot ' + Formatter.date(rr.endDate, true)
    }

    return null;
}

function setResponsibilityEnabled(responsibility: MemberResponsibility, groupId: string|null|undefined, enabled: boolean) {
    if (enabled === isResponsibilityEnabled(responsibility, groupId)) {
        return;
    }

    if (enabled) {
        const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null))

        if (originalEnabled) {
            // Restore original state
            const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()
            patch.addPatch(MemberResponsibilityRecord.patch({
                id: originalEnabled.id,
                endDate: null
            }))

            props.member.addPatch({
                responsibilities: patch
            })
            return;
        }

        // Create a new one
        const record = MemberResponsibilityRecord.create({
            memberId: props.member.id,
            responsibilityId: responsibility.id,
            startDate: new Date(),
            endDate: null,
            organizationId: selectedOrganization?.value?.id ?? null,
            groupId: groupId ?? null
        })

        const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()
        patch.addPut(record)

        props.member.addPatch({
            responsibilities: patch
        })
        return;
    }

    const current = props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null))
    if (!current) {
        return;
    }
    const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()

    // Did we already have this?
    const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null))
    if (originalEnabled && originalEnabled.id === current.id) {
        patch.addPatch(MemberResponsibilityRecord.patch({
            id: current.id,
            endDate: new Date()
        }))
    } else {
        patch.addDelete(current.id)
    }

    props.member.addPatch({
        responsibilities: patch
    })

}

function getResponsibilityMergedRole(responsibility: MemberResponsibility, groupId: string|null|undefined) {
    return LoadedPermissions.buildRoleForResponsibility(groupId ?? null, responsibility, selectedOrganization.value?.privateMeta?.inheritedResponsibilityRoles ?? []);
}

function getResponsibilityMergedRoleDescription(responsibility: MemberResponsibility, groupId: string|null|undefined) {
    return getResponsibilityMergedRole(responsibility, groupId).getDescription()
}

</script>
