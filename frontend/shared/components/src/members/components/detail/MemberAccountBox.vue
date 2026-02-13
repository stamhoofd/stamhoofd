<template>
    <STGridItem class="hover-box">
        <template v-if="user.hasAccount && user.verified" #left>
            <span class="icon user small" />
        </template>
        <template v-else-if="user.hasAccount && !user.verified" #left>
            <span class="icon email small" :v-tooltip="$t('726b28db-0878-4441-8cc9-a75ed6734a24')" />
        </template>
        <template v-else #left>
            <span class="icon email small" :v-tooltip="$t('d900b182-3fd8-4607-824f-b4a1f4a60e6c')" />
        </template>
        <template v-if="(user.firstName || user.lastName)">
            <h3 v-if="user.firstName || user.lastName" class="style-title-list">
                <span>{{ user.firstName }} {{ user.lastName }}</span>
                <span v-if="user.memberId === member.id" v-tooltip="$t('8e6f7cf0-e785-4d26-b6cf-80ddb912e87b', {member: member.patchedMember.firstName})" class="icon dot small primary" />
            </h3>
            <p class="style-description-small" :class="{'style-copyable': canManageEmailAddress && emailWarningMessage}" @click="onClickEmail">
                {{ user.email }}
            </p>
        </template>
        <h3 v-else class="style-title-list" :class="{'style-copyable': canManageEmailAddress && emailWarningMessage}" @click="onClickEmail">
            {{ user.email }}
        </h3>
        <p v-if="user.permissions && app !== 'registration' && !user.permissions.isEmpty && !hasEmptyAccess(user)" class="style-description-small">
            {{ $t('d5be56ba-2189-47b0-a32f-ef92cac0c2f8') }}
        </p>

        <template v-if="canReadEmailInformation" #middleRight>
            <EmailWarningMessage :message="emailWarningMessage" />
        </template>

        <template v-if="app !== 'registration' && hasWrite && user.hasAccount" #right>
            <LoadingButton :loading="isDeleting" class="hover-show">
                <button type="button" class="button icon trash" @click.stop="deleteUser(user)" />
            </LoadingButton>
        </template>
    </STGridItem>
</template>

<script setup lang="ts">
import { PlatformMember, User } from '@stamhoofd/structures';
import { useAppContext } from '../../../context/appContext';
import STGridItem from '../../../layout/STGridItem.vue';
import { useManageMemberEmail } from '../../composables/useManageMemberEmail';
import EmailWarningMessage from './EmailWarningMessage.vue';

const props = defineProps<{
    member: PlatformMember;
    user: User;
    isDeleting: boolean;
    hasEmptyAccess: (user: User) => boolean;
    hasWrite: boolean;
}>();

const emits = defineEmits<{
    (e: 'deleteUser', user: User): void;
}>();

const app = useAppContext();

async function deleteUser(user: User) {
    emits('deleteUser', user);
}

const { emailWarningMessage, canManageEmailAddress, presentEmailInformation, canReadEmailInformation } = useManageMemberEmail(props.user.email);

function onClickEmail() {
    if (canManageEmailAddress.value && emailWarningMessage.value) {
        presentEmailInformation().catch(console.error);
    }
}
</script>
