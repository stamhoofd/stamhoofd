<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title" />

        <ScrollableSegmentedControl v-if="!organization && items.length" v-model="selectedOrganization" :items="items" :labels="labels" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="groupedResponsibilites.length === 0" class="info-box">
            {{ $t('f743df11-3d56-4c4a-a0eb-df8f818ba4e1') }}
        </p>

        <div v-for="({title: groupTitle, responsibilities}, index) of groupedResponsibilites" :key="''+index" class="container">
            <hr v-if="index > 0 || !(!organization && items.length)"><h2 v-if="groupTitle && groupedResponsibilites.length > 1">
                {{ groupTitle }}
            </h2>

            <STList>
                <STListItem v-for="{responsibility, group} of responsibilities" :key="responsibility.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox :model-value="isResponsibilityEnabled(responsibility, group?.id)" @update:model-value="setResponsibilityEnabled(responsibility, group?.id, $event)" />
                    </template>

                    <h2 class="style-title-list">
                        {{ responsibility.name }}<template v-if="group">
                            {{ $t('e9ec956f-3a71-4460-b09d-dfec22a1aaf0') }} {{ group.settings.name }}
                        </template>
                    </h2>
                    <p v-if="group && selectedOrganization && group.periodId === selectedOrganization?.period.period.id" class="style-description-small">
                        {{ selectedOrganization.period.period.nameShort }}
                    </p>
                    <p v-else-if="group" class="style-description-small">
                        {{ $t('9685e11f-a4d0-4709-9f5e-875957ad269b') }}
                    </p>

                    <p class="style-description-small">
                        {{ $t('52acb4e7-fb83-4406-8119-9adbda0ecc22') }}: {{ getResponsibilityMergedRoleDescription(responsibility, group?.id) }}
                    </p>

                    <p v-if="getResponsibilityEnabledDescription(responsibility, group?.id)" class="style-description-small">
                        {{ getResponsibilityEnabledDescription(responsibility, group?.id) }}
                    </p>
                    <p class="style-description-small">
                        {{ responsibility.description }}
                    </p>

                    <template #right>
                        <ResponsibilityIcon :responsibility="responsibility" :group="group" :organization="selectedOrganization" />
                    </template>
                </STListItem>
            </STList>
        </div>

        <div v-if="deletedMemberResponsibilityRecords.length > 0" class="container">
            <hr><h2>{{ $t('e81e0bdb-c15f-4b9a-abca-172a8d379993') }}</h2>
            <STList>
                <STListItem v-for="record of deletedMemberResponsibilityRecords" :key="record.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox :model-value="isMemberResponsibilityRecordEnabled(record)" @update:model-value="setMemberResponsibilityRecordEnabled(record, $event)" />
                    </template>

                    <h2>{{ record.getName(member) }}</h2>

                    <p v-if="record.group && selectedOrganization && record.group.periodId === selectedOrganization?.period.period.id" class="style-description-small">
                        {{ selectedOrganization.period.period.nameShort }}
                    </p>
                    <p v-else-if="record.group" class="style-description-small">
                        {{ $t('9685e11f-a4d0-4709-9f5e-875957ad269b') }}
                    </p>

                    <p class="style-description-small">
                        {{ $t('52acb4e7-fb83-4406-8119-9adbda0ecc22') }}: {{ getResponsibilityRecordMergedRoleDescription(record) }}
                    </p>

                    <p v-if="getResponsibilityRecordEnabledDescription(record)" class="style-description-small">
                        {{ getResponsibilityRecordEnabledDescription(record) }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Group, LoadedPermissions, MemberResponsibility, MemberResponsibilityRecord, Organization, PlatformMember } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ScrollableSegmentedControl, useOrganization, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Formatter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import ResponsibilityIcon from '../ResponsibilityIcon.vue';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
}>();

const errors = useErrors({ validator: props.validator });
const platform = usePlatform();
const organization = useOrganization();
const $t = useTranslate();

const items = computed(() => {
    if (organization.value) {
        return [organization.value];
    }
    // Only show organization that have an active registration in the organization active period
    return [...props.member.filterOrganizations({ currentPeriod: true, withResponsibilities: true }), null];
});

const platformResponsibilities = computed(() => {
    if (selectedOrganization.value === null) {
        return platform.value.config.responsibilities.filter(r => !r.organizationBased);
    }
    const org = selectedOrganization.value;
    return platform.value.config.responsibilities.filter(r => r.organizationBased && (r.organizationTagIds === null || org.meta.matchTags(r.organizationTagIds)));
});

const selectedOrganization = ref((items.value[0] ?? null) as any) as Ref<Organization | null>;

const organizationResponsibilities = computed(() => {
    return selectedOrganization.value?.privateMeta?.responsibilities ?? [];
});

const groupedResponsibilites = computed(() => {
    const groupedPlatformResponsibilities: { responsibility: MemberResponsibility; group: Group | null }[] = [];
    const groupedOrganizationResponsibilities: { responsibility: MemberResponsibility; group: Group | null }[] = [];
    const organizationGroups = selectedOrganization.value?.period.adminCategoryTree.getAllGroups() ?? [];

    for (const responsibility of platformResponsibilities.value) {
        if (responsibility.defaultAgeGroupIds === null) {
            groupedPlatformResponsibilities.push({
                responsibility: responsibility,
                group: null,
            });
        }

        for (const group of organizationGroups) {
            if (group.defaultAgeGroupId && responsibility.defaultAgeGroupIds !== null && responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                groupedPlatformResponsibilities.push({
                    responsibility: responsibility,
                    group: group,
                });
            }
        }
    }

    for (const responsibility of organizationResponsibilities.value) {
        if (responsibility.defaultAgeGroupIds === null) {
            groupedOrganizationResponsibilities.push({
                responsibility: responsibility,
                group: null,
            });
            continue;
        }
    }

    // Merge non-empty groups
    const groups: { title: string; responsibilities: { responsibility: MemberResponsibility; group: Group | null }[] }[] = [];

    if (groupedPlatformResponsibilities.length > 0) {
        groups.push({
            title: selectedOrganization.value === null ? '' : 'Standaardfuncties',
            responsibilities: groupedPlatformResponsibilities,
        });
    }

    if (groupedOrganizationResponsibilities.length > 0) {
        groups.push({
            title: 'Groepseigenfuncties',
            responsibilities: groupedOrganizationResponsibilities,
        });
    }

    return groups;
});

const disabledMemberResponsibilityRecords = ref([]) as Ref<MemberResponsibilityRecord[]>;

const deletedMemberResponsibilityRecords = computed(() => {
    const result: MemberResponsibilityRecord[] = [];

    for (const responsibilityRecord of props.member.patchedMember.responsibilities.filter(r => (r.endDate === null || disabledMemberResponsibilityRecords.value.find(x => x.id === r.id)) && r.organizationId === (selectedOrganization.value?.id ?? null))) {
        const isDeleted = groupedResponsibilites.value.find(x => x.responsibilities.find(r => r.responsibility.id === responsibilityRecord.responsibilityId && (r.group?.id ?? null) === responsibilityRecord.groupId)) === undefined;

        if (isDeleted) {
            result.push(responsibilityRecord);
        }
    }

    return result;
});

const labels = computed(() => {
    return items.value.map(o => o === null ? 'Nationaal niveau' : o.name);
});

const title = computed(() => {
    return 'Functies van ' + props.member.patchedMember.firstName;
});

useValidation(errors.validator, () => {
    const se = new SimpleErrors();

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }
    errors.errorBox = null;

    return true;
});

function isResponsibilityEnabled(responsibility: MemberResponsibility, groupId?: string | null) {
    return !!props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null));
}

function getResponsibilityEnabledDescription(responsibility: MemberResponsibility, groupId?: string | null) {
    const rr = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null));

    if (rr) {
        if (!rr.endDate) {
            return 'Van ' + Formatter.date(rr.startDate, true) + ' tot nu';
        }
        return 'Van ' + Formatter.date(rr.startDate, true) + ' tot ' + Formatter.date(rr.endDate, true);
    }

    return null;
}

function getResponsibilityRecordEnabledDescription(record: MemberResponsibilityRecord | undefined) {
    if (record) {
        if (!record.endDate) {
            return 'Van ' + Formatter.date(record.startDate, true) + ' tot nu';
        }
        return 'Van ' + Formatter.date(record.startDate, true) + ' tot ' + Formatter.date(record.endDate, true);
    }

    return null;
}

function setResponsibilityEnabled(responsibility: MemberResponsibility, groupId: string | null | undefined, enabled: boolean) {
    if (enabled === isResponsibilityEnabled(responsibility, groupId)) {
        return;
    }

    if (enabled) {
        const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null));

        if (originalEnabled) {
            // Restore original state
            const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray();
            patch.addPatch(MemberResponsibilityRecord.patch({
                id: originalEnabled.id,
                endDate: null,
            }));

            props.member.addPatch({
                responsibilities: patch,
            });
            return;
        }

        // Create a new one
        const record = MemberResponsibilityRecord.create({
            memberId: props.member.id,
            responsibilityId: responsibility.id,
            startDate: new Date(),
            endDate: null,
            organizationId: selectedOrganization?.value?.id ?? null,
            groupId: groupId ?? null,
        });

        const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray();
        patch.addPut(record);

        props.member.addPatch({
            responsibilities: patch,
        });
        return;
    }

    const current = props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null));
    if (!current) {
        return;
    }
    const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray();

    // Did we already have this?
    const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null) && r.groupId === (groupId ?? null));
    if (originalEnabled && originalEnabled.id === current.id) {
        patch.addPatch(MemberResponsibilityRecord.patch({
            id: current.id,
            endDate: new Date(),
        }));
    }
    else {
        patch.addDelete(current.id);
    }

    props.member.addPatch({
        responsibilities: patch,
    });
}

function isMemberResponsibilityRecordEnabled(record: MemberResponsibilityRecord) {
    return (disabledMemberResponsibilityRecords.value).find(r => r.id === record.id) === undefined;
}

function setMemberResponsibilityRecordEnabled(record: MemberResponsibilityRecord, enabled: boolean) {
    if (enabled === isMemberResponsibilityRecordEnabled(record)) {
        return;
    }

    if (enabled) {
        const index = disabledMemberResponsibilityRecords.value.findIndex(r => r.id === record.id);
        disabledMemberResponsibilityRecords.value.splice(index, 1);

        // Restore original state
        const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray();
        patch.addPatch(MemberResponsibilityRecord.patch({
            id: record.id,
            endDate: null,
        }));

        props.member.addPatch({
            responsibilities: patch,
        });
        return;
    }

    disabledMemberResponsibilityRecords.value.push(record);

    const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray();

    patch.addPatch(MemberResponsibilityRecord.patch({
        id: record.id,
        endDate: new Date(),
    }));

    props.member.addPatch({
        responsibilities: patch,
    });
}

function getResponsibilityMergedRole(responsibility: MemberResponsibility, groupId: string | null | undefined) {
    return LoadedPermissions.fromResponsibility(responsibility, groupId ?? null, selectedOrganization.value?.privateMeta?.inheritedResponsibilityRoles ?? []);
}

function getResponsibilityMergedRoleDescription(responsibility: MemberResponsibility, groupId: string | null | undefined) {
    return getResponsibilityMergedRole(responsibility, groupId).getDescription();
}

function getResponsibilityFromRecord(record: MemberResponsibilityRecord): {
    responsibility: MemberResponsibility;groupId: string | null; } | null {
    for (const groupData of groupedResponsibilites.value) {
        const responsibility = groupData.responsibilities.find(r => r.responsibility.id === record.responsibilityId);

        if (responsibility) {
            return {
                responsibility: responsibility.responsibility,
                groupId: responsibility.group?.id ?? null,
            };
        }
    }

    return null;
}

function getResponsibilityRecordMergedRoleDescription(record: MemberResponsibilityRecord) {
    const result = getResponsibilityFromRecord(record);

    if (result) {
        return getResponsibilityMergedRole(result.responsibility, result.groupId).getDescription();
    }

    return $t('02ef437e-2166-49be-b5ae-73e5452546a0');
}
</script>
