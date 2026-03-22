<template>
    <STListItem v-long-press="editRegistration" v-color="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization.meta.color : null" :selectable="isEditable" class="hover-box right-stack" :class="{'theme-secundary': !registration.deactivatedAt && registration.isTrial, 'theme-error': !!registration.deactivatedAt}" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
        <template #left>
            <GroupIconWithWaitingList :group="group" :icon="registration.deactivatedAt ? 'disabled error' : (registration.isTrial? 'trial secundary' : '')" :organization="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization : null" />
        </template>
        <p v-if="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id)" class="style-title-prefix-list">
            {{ registrationOrganization.name }}
        </p>
        <p v-else-if="registration.deactivatedAt" class="style-title-prefix-list">
            {{ $t('%7y') }}
        </p>
        <p v-else-if="registration.isTrial" class="style-title-prefix-list">
            {{ $t('%1IH') }}
        </p>

        <h3 class="style-title-list">
            <span>{{ group.settings.name }}</span>
        </h3>
        <p v-if="defaultAgeGroup && group.settings.name.toString() !== defaultAgeGroup && app === 'admin'" class="style-description-small" v-text="defaultAgeGroup" />

        <p v-if="registration.description" class="style-description-small pre-wrap" v-text="registration.description" />

        <p v-if="registration.startDate" class="style-description-small">
            {{ $t('%fp') }} {{ formatDate(registration.startDate) }}
        </p>

        <p v-if="registration.registeredAt && !(registration.startDate && formatDate(registration.registeredAt) === formatDate(registration.startDate))" class="style-description-small">
            {{ $t('%fq') }} {{ formatDate(registration.registeredAt) }}
        </p>
        <p v-if="registration.deactivatedAt" class="style-description-small">
            {{ $t('%fr') }} {{ formatDate(registration.deactivatedAt) }}
        </p>
        <p v-if="registration.isTrial && registration.trialUntil" class="style-description-small">
            {{ $t('%fs') }} {{ formatDate(registration.trialUntil) }}
        </p>
        <p v-else-if="registration.startDate && registration.trialUntil" class="style-description-small">
            {{ $t('%ft') }} {{ Formatter.dateNumber(registration.startDate) }} tot {{ Formatter.dateNumber(registration.trialUntil) }}
        </p>

        <p v-if="!registration.registeredAt && registration.canRegister" class="style-description-small">
            {{ $t('%fu') }}
        </p>

        <p v-if="registration.payingOrganizationId" class="style-description-small">
            {{ $t('%fv') }}
        </p>

        <p v-if="registration.deactivatedAt && registration.calculatedPrice" class="style-description-small">
            {{ $t('%16t') }}: {{ formatPrice(registration.calculatedPrice) }}
        </p>

        <template #right>
            <span v-if="!registration.deactivatedAt && registration.balances.length" class="style-price-base">{{ formatPrice(registration.calculatedPrice) }}</span>
            <span v-if="isEditable" class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PlatformMember, Registration } from '@stamhoofd/structures';
import { GroupType } from '@stamhoofd/structures';
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
    if (group.value.type !== GroupType.Membership) {
        return null;
    }
    
    if (!group.value.defaultAgeGroupId) {
        return $t(`%10I`);
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
