<template>
    <STListItem v-long-press="editInvitation" v-color="invitationOrganization && (app !== 'dashboard' || !organization || invitationOrganization.id !== organization.id) ? invitationOrganization.meta.color : null" :selectable="isEditable" class="hover-box right-stack" @contextmenu.prevent="editInvitation($event)" @click.prevent="editInvitation($event)">
        <template #left>
            <RegistrationInvitationIcon v-if="group" :group="group" :organization="invitationOrganization" />
            <IconContainer v-else>
                <figure>
                    <span>{{ Formatter.firstLetters(invitationGroupData.name, 2) }}</span>
                </figure>
                <template #aside>
                    <span class="icon email-filled stroke small" />
                </template>
            </IconContainer>
        </template>
        <p v-if="invitationOrganization && (app !== 'dashboard' || !organization || invitationOrganization.id !== organization.id)" class="style-title-prefix-list">
            {{ invitationOrganization.name }}
        </p>

        <h3 class="style-title-list">
            <span>{{ $t('Uitgenodigd voor {name}', {name: invitationGroupData.name}) }}</span>
        </h3>

        <p v-if="invitation.createdAt" class="style-description-small">
            {{ $t('Uitgenodigd op {date}', {date: Formatter.date(invitation.createdAt) }) }}
        </p>

        <template #right>
            <span v-if="isEditable" class="icon arrow-down-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { MemberRegistrationInvitation, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, getCurrentInstance } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { useOrganization } from '../../../hooks';
import IconContainer from '../../../icons/IconContainer.vue';
import RegistrationInvitationIcon from '../../../quick-actions/RegistrationInvitationIcon.vue';

const props = defineProps<{
    invitation: MemberRegistrationInvitation;
    member: PlatformMember;
}>();

const emit = defineEmits(['edit']);
const instance = getCurrentInstance();
const organization = useOrganization();
const app = useAppContext();
const isEditable = computed(() => {
    return !!instance?.vnode.props?.onEdit;
});

const invitationGroupData = computed(() => {
    return props.invitation.group;
});

const invitationOrganization = computed(() => {
    return props.member.organizations.find(o => o.id === props.invitation.organizationId);
});

const group = computed(() => {
    const organization = invitationOrganization.value;
    if (!organization) {
        // todo
        return null;
    }

    if (organization.period.period.id === invitationGroupData.value.periodId) {
        const groupId = invitationGroupData.value.id;
        const group = organization.period.groups.find(g => g.id === groupId);
        return group;
    }

    return null;
})

function editInvitation(event: any) {
    emit('edit', event);
}
</script>
