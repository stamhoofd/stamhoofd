<template>
    <div v-if="member.patchedMember.users.length > 0" class="hover-box container">
        <hr><h2 class="style-with-button">
            <span class="icon-spacer">{{ $t('9b625e82-f571-4fc6-a83b-47cb14ac1739') }}</span>
            <a v-if="!$isTouch && app !== 'registration'" class="button icon gray help" target="_blank" :href="$domains.getDocs('leden-beheren-met-meerdere-ouders')" />
        </h2>
        <p>{{ $t('db162d2e-be1b-4e8a-9915-b1e58ffa0aca', {member: member.patchedMember.firstName}) }}</p>
        <STGrid>
            <STGridItem v-for="user in sortedUsers" :key="user.id" class="hover-box">
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
                    <p class="style-description-small">
                        {{ user.email }}
                    </p>
                </template>
                <h3 v-else class="style-title-list">
                    {{ user.email }}
                </h3>
                <p v-if="user.permissions && app !== 'registration' && !user.permissions.isEmpty && !hasEmptyAccess(user)" class="style-description-small">
                    {{ $t('d5be56ba-2189-47b0-a32f-ef92cac0c2f8') }}
                </p>

                <template v-if="shouldShowEmailWarning()" #middleRight>
                    <EmailWarning :email="user.email" />
                </template>

                <template v-if="app !== 'registration' && hasWrite && user.hasAccount" #right>
                    <LoadingButton :loading="isDeletingUser(user)" class="hover-show">
                        <button type="button" class="button icon trash" @click.stop="deleteUser(user)" />
                    </LoadingButton>
                </template>
            </STGridItem>
        </STGrid>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { MemberWithRegistrationsBlob, PermissionLevel, PlatformMember, User } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAdmins } from '../../../admins/hooks/useAdmins';
import { useAppContext } from '../../../context/appContext';
import { useAuth, useShouldShowEmailWarning } from '../../../hooks';
import STGrid from '../../../layout/STGrid.vue';
import STGridItem from '../../../layout/STGridItem.vue';
import { Toast } from '../../../overlays/Toast';
import { usePlatformFamilyManager } from '../../PlatformFamilyManager';
import EmailWarning from '../detail/EmailWarning.vue';

defineOptions({
    inheritAttrs: false,
});
const props = defineProps<{
    member: PlatformMember;
}>();
const auth = useAuth();
const app = useAppContext();
const hasWrite = computed(() => auth.canAccessPlatformMember(props.member, PermissionLevel.Write));
const deletingUsers = ref(new Set<string>());
const platformFamilyManager = usePlatformFamilyManager();
const { hasEmptyAccess } = useAdmins(false);
const shouldShowEmailWarning = useShouldShowEmailWarning();

const sortedUsers = computed(() => {
    return props.member.patchedMember.users.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byBooleanValue(a.id === props.member.id, b.id === props.member.id),
            Sorter.byBooleanValue(a.hasAccount, b.hasAccount),
        );
    });
});

async function deleteUser(user: User) {
    if (deletingUsers.value.has(user.id)) {
        return;
    }

    deletingUsers.value.add(user.id);

    try {
        const patch = MemberWithRegistrationsBlob.patch({ id: props.member.id });
        patch.users.addDelete(user.id);

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPatch(patch);
        await platformFamilyManager.isolatedPatch([props.member], arr);
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    deletingUsers.value.delete(user.id);
}

function isDeletingUser(user: User) {
    return deletingUsers.value.has(user.id);
}
</script>
