<template>
    <STListItem v-long-press="editRegistration" v-color="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization.meta.color : null" :selectable="isEditable" class="hover-box right-stack" :class="{'theme-secundary': !registration.deactivatedAt && registration.isTrial, 'theme-error': !!registration.deactivatedAt}" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
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
        <p v-if="defaultAgeGroup && group.settings.name.toString() !== defaultAgeGroup && app === 'admin'" class="style-description-small" v-text="defaultAgeGroup" />

        <p v-if="registration.description" class="style-description-small pre-wrap" v-text="registration.description" />

        <p v-if="registration.startDate" class="style-description-small">
            {{ $t('44567967-8a8b-480a-b6e0-d802459b7bd5') }} {{ formatDate(registration.startDate) }}
        </p>

        <p v-if="registration.registeredAt && !(registration.startDate && formatDate(registration.registeredAt) === formatDate(registration.startDate))" class="style-description-small">
            {{ $t('bb0b39ca-9822-4215-a79a-4be940cfc0c6') }} {{ formatDate(registration.registeredAt) }}
        </p>
        <p v-if="registration.deactivatedAt" class="style-description-small">
            {{ $t('e8d02ca3-9828-405b-a885-53982c54f6e8') }} {{ formatDate(registration.deactivatedAt) }}
        </p>
        <p v-if="registration.isTrial && registration.trialUntil" class="style-description-small">
            {{ $t('87c51af2-6e81-4342-a18d-2f15bec7c6cb') }} {{ formatDate(registration.trialUntil) }}
        </p>
        <p v-else-if="registration.startDate && registration.trialUntil" class="style-description-small">
            {{ $t('8c15d15c-0857-48b4-a2cb-296791d098dc') }} {{ Formatter.dateNumber(registration.startDate) }} tot {{ Formatter.dateNumber(registration.trialUntil) }}
        </p>

        <p v-if="!registration.registeredAt && registration.canRegister" class="style-description-small">
            {{ $t('b6f9e628-5c06-44e6-b0ae-a0c23d5de4e9') }}
        </p>

        <p v-if="registration.payingOrganizationId" class="style-description-small">
            {{ $t('1db1b8fa-1544-43be-a016-9d38c62cd8aa') }}
        </p>

        <p v-if="registration.deactivatedAt && registration.calculatedPrice" class="style-description-small">
            {{ $t('Annulatiekost') }}: {{ formatPrice(registration.calculatedPrice) }}
        </p>

        <template #right>
            <span v-if="!registration.deactivatedAt && registration.balances.length" class="style-price-base">{{ formatPrice(registration.calculatedPrice) }}</span>
            <span v-if="isEditable" class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformMember, Registration } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, getCurrentInstance } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { useNow, useOrganization, usePlatform } from '../../../hooks';
import GroupIconWithWaitingList from '../group/GroupIconWithWaitingList.vue';

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
const isDeactivated = computed(() => props.registration.deactivatedAt !== null);
const isEditable = computed(() => {
    if (isDeactivated.value) {
        return false;
    }
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
        return $t(`22e7c344-54b6-493e-84c3-cbb453810781`);
    }
    return platform.value.config.defaultAgeGroups.find(ag => ag.id === group.value.defaultAgeGroupId)?.name;
});

function editRegistration(event: any) {
    if (isDeactivated.value) {
        return;
    }
    emit('edit', event);
}
</script>
