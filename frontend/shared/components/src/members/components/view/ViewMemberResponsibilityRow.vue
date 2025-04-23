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
            {{ $t('Sinds {date}', {date: formatDate(responsibility.startDate, true)}) }}
        </p>

        <p v-if="responsibility.endDate" class="style-description-small">
            {{ $t('Loopt automatisch af op {date}', {date: formatDateTime(responsibility.endDate) }) }}
        </p>

        <template #right>
            <span v-if="!hasRegistration" v-tooltip="$t('71b37c1d-7a2d-41c9-a6c0-fcd9c69a2492', {name: member.patchedMember.firstName})" class="icon warning yellow" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { MemberResponsibilityRecord, PlatformMember } from '@stamhoofd/structures';
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

const responsibilityOrganization = computed(() => {
    return props.member.organizations.find(o => o.id === props.responsibility.organizationId);
});

const group = computed(() => {
    return props.responsibility.group;
});

const resp = computed(() => {
    return platform.value.config.responsibilities.find(rr => rr.id === props.responsibility.responsibilityId)
        ?? responsibilityOrganization.value?.privateMeta?.responsibilities?.find(rr => rr.id === props.responsibility.responsibilityId)
        ?? null;
});

const name = computed(() => {
    const suffix = group.value ? ` van ${group.value.settings.name}` : (props.responsibility.groupId ? ' van onbekende groep' : '');
    return (resp.value?.name ?? 'Verwijderde functie') + suffix;
});

const hasRegistration = computed(() => {
    return props.member.filterRegistrations({ currentPeriod: true, organizationId: responsibilityOrganization.value?.id ?? undefined }).length > 0;
});
</script>
