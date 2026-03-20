<template>
    <div v-if="member.patchedMember.users.length > 0" class="hover-box container">
        <hr><h2 class="style-with-button">
            <span class="icon-spacer">{{ $t('%1a') }}</span>
            <a v-if="!$isTouch && app !== 'registration'" class="button icon gray help" target="_blank" :href="$domains.getDocs('leden-beheren-met-meerdere-ouders')" />
        </h2>
        <p>{{ $t('%ff', {member: member.patchedMember.firstName}) }}</p>
        <STGrid>
            <MemberAccountBox v-for="user in sortedUsers" :key="user.id" :member="member" :user="user" :is-deleting="isDeletingUser(user)" :has-empty-access="hasEmptyAccess" :has-write="hasWrite" @delete-user="deleteUser" />
        </STGrid>
    </div>
</template>

<script setup lang="ts">
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import type { PlatformMember, User } from '@stamhoofd/structures';
import { MemberWithRegistrationsBlob, PermissionLevel } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAdmins } from '../../../admins/hooks/useAdmins';
import { useAppContext } from '../../../context/appContext';
import { useAuth } from '../../../hooks';
import STGrid from '../../../layout/STGrid.vue';
import { Toast } from '../../../overlays/Toast';
import { usePlatformFamilyManager } from '../../PlatformFamilyManager';
import MemberAccountBox from '../detail/MemberAccountBox.vue';

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
