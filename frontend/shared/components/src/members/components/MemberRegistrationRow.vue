<template>
    <STListItem v-long-press="editRegistration" :selectable="isEditable" class="left-center hover-box" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
        <template #left>
            <GroupIcon :group="group" :icon="registration.deactivatedAt ? 'canceled' : ''"/>
        </template>
        <h3 class="style-title-list">
            {{ group.settings.name }}
        </h3>
        <p v-if="registrationOrganization && (!organization || registrationOrganization.id !== organization.id)" class="style-description-small">
            {{ registrationOrganization.name }}
        </p>

        <p v-if="registration.registeredAt" class="style-description-small">
            Ingeschreven op {{ formatDateTime(registration.registeredAt) }}
        </p>
        <p v-if="registration.deactivatedAt" class="style-description-small">
            Uitgeschreven op {{ formatDateTime(registration.deactivatedAt) }}
        </p>

        <p v-if="!registration.registeredAt && registration.canRegister" class="style-description-small">
            Uitgenodigd om in te schrijven
        </p>

        <!-- For permissions: the backend should set the price to zero, if this is visible we should fix it there -->
        <p v-if="registration.price" class="style-description-small">
            <span class="style-price-base">{{ formatPrice(registration.price) }}</span>
        </p>

        <template v-if="isEditable" #right>
            <span class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformMember, Registration } from '@stamhoofd/structures';
import { computed, getCurrentInstance } from 'vue';
import { useOrganization } from '../../hooks';
import GroupIcon from './group/GroupIcon.vue';

const props = defineProps<{
    registration: Registration;
    member: PlatformMember
}>();
const emit = defineEmits(["edit"]);

const instance = getCurrentInstance();
const organization = useOrganization();
const isEditable = computed(() => {
    return !!instance?.vnode.props?.onEdit
})
const group = computed(() => {
    return props.registration.group
})
const registrationOrganization = computed(() => {
    return props.member.organizations.find(o => o.id === group.value.organizationId)
})

function editRegistration(event: any) {
    emit("edit", event)
}
</script>
