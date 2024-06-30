<template>
    <STListItem v-long-press="editRegistration" :selectable="isEditable" class="left-center hover-box member-registration-block" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
        <template #left>
            <GroupIcon :group="group" :waiting-list="registration.waitingList" />
        </template>
        <h3 class="style-title-list">
            {{ group.settings.name }}
        </h3>
        <p v-if="registrationOrganization && (!organization || registrationOrganization.id !== organization.id)" class="style-description-small">
            {{ registrationOrganization.name }}
        </p>

        <p v-if="!registration.waitingList && registration.registeredAt" class="style-description-small">
            Ingeschreven op {{ formatDateTime(registration.registeredAt) }}
        </p>
        <p v-else class="style-description-small">
            Op wachtlijst sinds {{ formatDateTime(registration.createdAt) }}
        </p>
        <p v-if="registration.waitingList && registration.canRegister" class="style-description-small">
            Toegelaten om in te schrijven
        </p>

        <template v-if="isEditable" #right>
            <span class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { Group, GroupSettings, PlatformMember, Registration } from '@stamhoofd/structures';
import { computed, getCurrentInstance } from 'vue';
import GroupIcon from './group/GroupIcon.vue';
import { useOrganization } from '../../hooks';

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
