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
            {{ $t('%g1', {date: formatDate(responsibility.startDate, true)}) }}
        </p>

        <p v-if="responsibility.endDate" class="style-description-small">
            {{ $t('%g2', {date: formatDateTime(responsibility.endDate) }) }}
        </p>

        <template #right>
            <span v-if="autoRemoveDate" v-tooltip="platformResponsibility ? $t('Deze functie wordt automatisch verwijderd op {date}, omdat {name} niet (meer) is ingeschreven bij een groep die aan een standaard leeftijdsgroep gekoppeld is.', {name: member.patchedMember.firstName, date: formatDate(autoRemoveDate, true)}) : $t('Deze functie wordt automatisch verwijderd op {date}, omdat {name} niet meer is ingeschreven.', {name: member.patchedMember.firstName, date: formatDate(autoRemoveDate, true)})" class="icon warning yellow" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import type { MemberResponsibilityRecord, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
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
    const suffix = group.value ? ` van ${group.value.settings.name.toString()}` : (props.responsibility.groupId ? ' ' + $t(`%10K`) : '');
    return (resp.value?.name ?? $t(`%qZ`)) + suffix;
});

// The date on which this responsibility will be automatically removed (null = it stays).
const autoRemoveDate = computed(() => {
    const currentPeriod = responsibilityOrganization.value?.period.period;
    if (!currentPeriod) {
        return null;
    }

    const platformResponsibilityIds = platform.value.config.responsibilities.map(r => r.id);
    return props.responsibility.getAutoRemoveDate(
        props.member.patchedMember.registrations,
        currentPeriod,
        platformResponsibilityIds,
    );
});
</script>
