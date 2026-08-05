<template>
    <STGridItem class="hover-box">
        <template v-if="user.hasAccount && user.verified" #left>
            <span class="icon user small" />
        </template>
        <template v-else-if="user.hasAccount && !user.verified" #left>
            <span class="icon email small" v-tooltip="$t('%fg')" />
        </template>
        <template v-else #left>
            <span class="icon email small" v-tooltip="$t('%fh')" />
        </template>
        <template v-if="(user.firstName || user.lastName)">
            <h3 v-if="user.firstName || user.lastName" class="style-title-list">
                <span>{{ user.firstName }} {{ user.lastName }}</span>
                <span v-if="user.memberId === member.id" v-tooltip="$t('%fi', {member: member.patchedMember.firstName})" class="icon dot small primary" />
            </h3>
            <p class="style-description-small">
                <EmailAddress :email="user.email" />
            </p>
        </template>
        <h3 v-else class="style-title-list">
            <EmailAddress :email="user.email" />
        </h3>
        <p v-if="user.permissions && app !== 'registration' && !user.permissions.isEmpty && !hasEmptyAccess(user)" class="style-description-small">
            {{ $t('%1B3') }}
        </p>
        <p v-if="lastActiveDescription" class="style-description-small">
            {{ lastActiveDescription }}
        </p>
        <p v-if="hasTwoFactor" class="style-description-small">
            {{ $t('%Zh5') }}
        </p>

        <template v-if="app !== 'registration' && user.hasAccount && (hasWrite || showImpersonate)" #right>
            <button v-if="showImpersonate" v-tooltip="$t('Aanmelden als deze gebruiker')" type="button" class="button icon eye hover-show" data-testid="impersonate-user" @click.stop="impersonate(user)" />
            <LoadingButton v-if="hasWrite" :loading="isDeleting" class="hover-show">
                <button type="button" class="button icon trash" @click.stop="deleteUser(user)" />
            </LoadingButton>
        </template>
    </STGridItem>
</template>

<script setup lang="ts">
import { getLastActiveDescription } from '#auth/userActivity.ts';
import { hasTwoFactor as usersHaveTwoFactor } from '#auth/twoFactor.ts';
import { useImpersonation } from '#admins/hooks/useImpersonation.ts';
import type { PlatformMember, User } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import STGridItem from '../../../layout/STGridItem.vue';
import EmailAddress from '../../../email/EmailAddress.vue';

const props = defineProps<{
    member: PlatformMember;
    user: User;
    isDeleting: boolean;
    hasEmptyAccess: (user: User) => boolean;
    hasWrite: boolean;
}>();

const lastActiveDescription = computed(() => getLastActiveDescription([props.user]));
const hasTwoFactor = computed(() => usersHaveTwoFactor([props.user]) === true);

const { canImpersonate, impersonate } = useImpersonation();
const showImpersonate = computed(() => canImpersonate(props.user));

const emits = defineEmits<{
    (e: 'deleteUser', user: User): void;
}>();

const app = useAppContext();

async function deleteUser(user: User) {
    emits('deleteUser', user);
}
</script>
