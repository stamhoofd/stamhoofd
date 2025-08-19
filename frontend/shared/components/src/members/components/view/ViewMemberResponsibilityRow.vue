<template>
    <STListItem v-color="responsibilityOrganization ? responsibilityOrganization.meta.color : null" class="hover-box right-stack">
        <template #left>
            <ResponsibilityIcon v-if="resp" :responsibility="resp" :group="group" :organization="responsibilityOrganization" />
        </template>

        <p v-if="responsibilityOrganization && (app !== 'dashboard' || !organization || responsibilityOrganization.id !== organization.id)" class="style-title-prefix-list">
            {{ responsibilityOrganization.name }}
        </p>

        <h3 class="style-title-list">
            {{ name }}
        </h3>

        <p v-if="responsibility.startDate" class="style-description-small">
            {{ $t('5e3c6c2c-5816-46fd-82f6-db3562c446d4', {date: formatDate(responsibility.startDate, true)}) }}
        </p>

        <p v-if="responsibility.endDate" class="style-description-small">
            {{ $t('06882818-006a-4070-aa0f-c805bb2a53d4', {date: formatDateTime(responsibility.endDate) }) }}
        </p>

        <template #right>
            <span v-if="!hasRegistration" v-tooltip="platformResponsibility ? $t('699edd60-afb0-4c4d-aac5-58f7a6b0ff1f', {name: member.patchedMember.firstName}) : $t('71b37c1d-7a2d-41c9-a6c0-fcd9c69a2492', {name: member.patchedMember.firstName})" class="icon warning yellow" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { GroupType, MemberResponsibilityRecord, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { useOrganization, usePlatform } from '../../../hooks';
import ResponsibilityIcon from '../ResponsibilityIcon.vue';

const props = defineProps<{
    responsibility: MemberResponsibilityRecord;
    member: PlatformMember;
}>();

const organization = useOrganization();
const platform = usePlatform();

const app = useAppContext();

const platformResponsibility = computed(() => {
    return platform.value.config.responsibilities.find(rr => rr.id === props.responsibility.responsibilityId);
});

const responsibilityOrganization = computed(() => {
    return props.member.organizations.find(o => o.id === props.responsibility.organizationId);
});

const group = computed(() => {
    return props.responsibility.group;
});

const resp = computed(() => {
    return platformResponsibility.value
        ?? responsibilityOrganization.value?.privateMeta?.responsibilities?.find(rr => rr.id === props.responsibility.responsibilityId)
        ?? null;
});

const name = computed(() => {
    const suffix = group.value ? ` van ${group.value.settings.name}` : (props.responsibility.groupId ? ' ' + $t(`d67b2375-8426-47de-8637-74557f6ad0a4`) : '');
    return (resp.value?.name ?? $t(`dce3d5b2-7cce-4ada-ab77-0572b2be509d`)) + suffix;
});

const hasRegistration = computed(() => {
    // If platform period is ending in 30 days, don't show message
    let periodId = platform.value.period.id;
    if (platform.value.period.endDate && platform.value.period.endDate < new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)) {
        if (organization.value && organization.value.period.period.previousPeriodId === platform.value.period.id) {
            // If the organization is in the next period, only show message if member not registered for that period
            periodId = organization.value.period.period.id;
        }
        else {
            return true;
        }
    }

    if (platformResponsibility.value) {
        // For platform responsibilities, a registration for a default age group is required
        return props.member.filterRegistrations({
            periodId,
            organizationId: responsibilityOrganization.value?.id ?? undefined,
            types: [GroupType.Membership],
            defaultAgeGroupIds: platform.value.config.defaultAgeGroups.map(da => da.id),
        }).length > 0;
    }
    return props.member.filterRegistrations({
        periodId,
        organizationId: responsibilityOrganization.value?.id ?? undefined,
        types: [GroupType.Membership],

    }).length > 0;
});
</script>
