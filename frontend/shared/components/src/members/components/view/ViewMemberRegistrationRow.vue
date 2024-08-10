<template>
    <STListItem v-long-press="editRegistration" v-color="registrationOrganization ? registrationOrganization.meta.color : null" :selectable="isEditable" class="hover-box" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
        <template #left>
            <GroupIcon :group="group" :icon="registration.deactivatedAt ? 'canceled' : ''" :organization="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id) ? registrationOrganization : null" />
        </template>
        <p v-if="registrationOrganization && (app !== 'dashboard' || !organization || registrationOrganization.id !== organization.id)" class="style-title-prefix-list">
            {{ registrationOrganization.name }}
        </p>
        <h3 class="style-title-list">
            {{ group.settings.name }}
        </h3>
        <p v-if="registration.description" class="style-description-small pre-wrap" v-text="registration.description" />

        <p v-if="registration.registeredAt" class="style-description-small">
            Ingeschreven op {{ formatDateTime(registration.registeredAt) }}
        </p>
        <p v-if="registration.deactivatedAt" class="style-description-small">
            Uitgeschreven op {{ formatDateTime(registration.deactivatedAt) }}
        </p>

        <p v-if="!registration.registeredAt && registration.canRegister" class="style-description-small">
            Uitgenodigd om in te schrijven
        </p>

        <template v-if="isEditable" #right>
            <span class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformMember, Registration } from '@stamhoofd/structures';
import { computed, getCurrentInstance } from 'vue';
import { useOrganization } from '../../../hooks';
import GroupIcon from '../group/GroupIcon.vue';
import { useAppContext } from '../../../context/appContext';

const props = defineProps<{
    registration: Registration;
    member: PlatformMember
}>();
const emit = defineEmits(["edit"]);

const instance = getCurrentInstance();
const organization = useOrganization();
const app = useAppContext()
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
