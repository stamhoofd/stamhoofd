<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title" />

        <ScrollableSegmentedControl v-model="selectedOrganization" :items="items" :labels="labels" v-if="!organization && items.length" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <p class="info-box" v-if="groupsWithResponsibilites.length === 0">
            Geen functies gevonden
        </p>

        <div class="container" v-for="(group, index) of groupsWithResponsibilites" :key="''+group.groupId">
            <hr v-if="index > 0 || !(!organization && items.length)">
            <h2 v-if="group.title">{{ group.title }}</h2>

            <STList>
                <STListItem v-for="responsibility of group.responsibilities" :key="responsibility.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox :model-value="isResponsibilityEnabled(responsibility, group.groupId)" @update:model-value="setResponsibilityEnabled(responsibility, group.groupId, $event)" />
                    </template>

                    <h2 class="style-title-list">
                        {{ responsibility.name }}
                    </h2>
                    <p class="style-description-small" v-if="getResponsibilityEnabledDescription(responsibility, group.groupId)">
                        {{ getResponsibilityEnabledDescription(responsibility, group.groupId) }}
                    </p>
                    <p class="style-description-small">
                        {{ responsibility.description }}
                    </p>
                </STListItem>
            </STList>
        </div>

        
    </div>
</template>

<script setup lang="ts">
import { MemberResponsibility, MemberResponsibilityRecord, Organization, PlatformMember } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { usePresent } from '@simonbackx/vue-app-navigation';
import { ScrollableSegmentedControl, useAuth, useOrganization, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
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
    const groups: {title: string, groupId: string|null, responsibilities: MemberResponsibility[]}[] = []
    let defaultGroup: MemberResponsibility[] = []

    for (const responsibility of platformResponsibilities.value) {
        if (responsibility.defaultAgeGroupIds === null) {
            defaultGroup.push(responsibility)
        }
    }
    
    if (defaultGroup.length > 0) {
        groups.push({
            title: selectedOrganization.value === null ? '' : 'Nationale functies',
            groupId: null,
            responsibilities: defaultGroup
        })
        defaultGroup = []
    }

    for (const responsibility of organizationResponsibilities.value) {
        if (responsibility.defaultAgeGroupIds === null) {
            defaultGroup.push(responsibility)
        }
    }
    
    if (defaultGroup.length > 0) {
        groups.push({
            title: 'Groepseigenfuncties',
            groupId: null,
            responsibilities: defaultGroup
        })
    }

    const organizationGroups = selectedOrganization.value?.period.adminCategoryTree.getAllGroups() ?? []
    for (const group of organizationGroups) {
        if (group.defaultAgeGroupId === null) {
            continue
        }

        const groupResponsibilities: MemberResponsibility[] = []
        for (const responsibility of [...platformResponsibilities.value, ...organizationResponsibilities.value]) {
            if (responsibility.defaultAgeGroupIds !== null && responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                groupResponsibilities.push(responsibility)
            }
        }

        if (groupResponsibilities.length > 0) {
            groups.push({
                title: group.settings.name,
                groupId: group.id,
                responsibilities: groupResponsibilities
            })
        }
    }

    return groups;
})

const labels = computed(() => {
    return items.value.map(o => o === null ? 'Nationaal' : o.name)
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


function isResponsibilityEnabled(responsibility: MemberResponsibility, groupId: string|null) {
    return !!props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === groupId)
}

function getResponsibilityEnabledDescription(responsibility: MemberResponsibility, groupId: string|null) {
    const rr = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === groupId)

    if (rr) {
        if (!rr.endDate) {
            return 'Van ' + Formatter.date(rr.startDate, true) + ' tot nu'
        }
        return 'Van ' + Formatter.date(rr.startDate, true) + ' tot ' + Formatter.date(rr.endDate, true)
    }

    return null;
}

function setResponsibilityEnabled(responsibility: MemberResponsibility, groupId: string|null, enabled: boolean) {
    if (enabled === isResponsibilityEnabled(responsibility, groupId)) {
        return;
    }

    if (enabled) {
        const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === groupId)

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
            groupId: groupId
        })

        const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()
        patch.addPut(record)

        props.member.addPatch({
            responsibilities: patch
        })
        return;
    }

    const current = props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === groupId)
    if (!current) {
        return;
    }
    const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()

    // Did we already have this?
    const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === groupId)
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
</script>
