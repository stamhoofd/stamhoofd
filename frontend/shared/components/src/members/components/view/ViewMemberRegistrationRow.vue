<template>
    <STListItem v-long-press="editRegistration" v-color="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization.meta.color : null" :selectable="isEditable" class="hover-box" :class="{'theme-secundary': !registration.deactivatedAt && registration.isTrial, 'theme-error': !!registration.deactivatedAt}" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
        <template #left>
            <GroupIconWithWaitingList :group="group" :icon="registration.deactivatedAt ? 'disabled error' : (registration.isTrial? 'trial secundary' : '')" :organization="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization : null" />
        </template>
        <p v-if="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id)" class="style-title-prefix-list">
            {{ registrationOrganization.name }}
        </p>
        <p v-else-if="registration.deactivatedAt" class="style-title-prefix-list">
            {{ $t('9f80f234-d51c-4ef2-ba59-fc55fb1044c4') }}
        </p>
        <p v-else-if="registration.isTrial" class="style-title-prefix-list">
            {{ $t('7e75723b-d09c-4722-942f-3ae2777de14c') }}
        </p>

        <h3 class="style-title-list">
            <span>{{ group.settings.name }}</span>
        </h3>
        <p v-if="defaultAgeGroup && group.settings.name !== defaultAgeGroup && app === 'admin'" class="style-description-small" v-text="defaultAgeGroup" />

        <p v-if="registration.description" class="style-description-small pre-wrap" v-text="registration.description" />

        <p v-if="registration.startDate" class="style-description-small">
            Gestart op {{ formatDate(registration.startDate) }}
        </p>

        <p v-if="registration.registeredAt && !(registration.startDate && formatDate(registration.registeredAt) === formatDate(registration.startDate))" class="style-description-small">
            Ingeschreven op {{ formatDate(registration.registeredAt) }}
        </p>
        <p v-if="registration.deactivatedAt" class="style-description-small">
            Uitgeschreven op {{ formatDate(registration.deactivatedAt) }}
        </p>
        <p v-if="registration.isTrial && registration.trialUntil" class="style-description-small">
            Proefperiode tot {{ formatDate(registration.trialUntil) }}
        </p>
        <p v-else-if="registration.startDate && registration.trialUntil" class="style-description-small">
            Had een proefperiode van {{ Formatter.dateNumber(registration.startDate) }} tot {{ Formatter.dateNumber(registration.trialUntil) }}
        </p>

        <p v-if="!registration.registeredAt && registration.canRegister" class="style-description-small">
            Uitgenodigd om in te schrijven
        </p>

        <p v-if="registration.payingOrganizationId" class="style-description-small">
            Via groepsinschrijving
        </p>

        <template v-if="isEditable" #right>
            <span class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformMember, Registration } from '@stamhoofd/structures';
import { computed, getCurrentInstance } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { useNow, useOrganization, usePlatform } from '../../../hooks';
import GroupIconWithWaitingList from '../group/GroupIconWithWaitingList.vue';
import { Formatter } from '@stamhoofd/utility';

const props = defineProps<{
    registration: Registration;
    member: PlatformMember;
}>();
const emit = defineEmits(['edit']);
const now = useNow();

const instance = getCurrentInstance();
const organization = useOrganization();
const platform = usePlatform();
const app = useAppContext();
const isEditable = computed(() => {
    return !!instance?.vnode.props?.onEdit;
});
const group = computed(() => {
    return props.registration.group;
});
const registrationOrganization = computed(() => {
    return props.member.organizations.find(o => o.id === group.value.organizationId);
});

const defaultAgeGroup = computed(() => {
    if (!group.value.defaultAgeGroupId) {
        return 'Geen standaard leeftijdsgroep';
    }
    return platform.value.config.defaultAgeGroups.find(ag => ag.id === group.value.defaultAgeGroupId)?.name;
});

function editRegistration(event: any) {
    emit('edit', event);
}
</script>
