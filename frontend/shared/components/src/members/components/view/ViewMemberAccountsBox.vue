<template>
    <div v-if="member.patchedMember.users.length > 0" class="hover-box container">
        <hr>
        <h2 class="style-with-button">
            <span class="icon-spacer">Accounts</span>
            <a
                v-if="!$isTouch && app !== 'registration'"
                class="button icon gray help"
                target="_blank"
                :href="$domains.getDocs('leden-beheren-met-meerdere-ouders')"
            />
        </h2>
        <p>Dit zijn alle e-mailadressen die toegang hebben tot de gegevens van {{ member.patchedMember.firstName }}. Hierop kan je inloggen of een account aanmaken.</p>
        <STList>
            <STListItem v-for="user in sortedUsers" :key="user.id" class="hover-box">
                <template v-if="user.hasAccount && user.verified" #left>
                    <span class="icon user small" />
                </template>
                <template v-else-if="user.hasAccount && !user.verified" #left>
                    <span v-tooltip="'Deze gebruiker moet het e-mailadres nog verifiëren.'" class="icon email small" />
                </template>
                <template v-else #left>
                    <span v-tooltip="'Deze gebruiker moet eerst registreren op dit emailadres en daarbij een wachtwoord instellen.'" class="icon email small" />
                </template>
                <template v-if="(user.firstName || user.lastName) && (user.name !== member.patchedMember.name)">
                    <h3 v-if="user.firstName || user.lastName" class="style-title-list">
                        {{ user.firstName }} {{ user.lastName }}
                    </h3>
                    <p class="style-description-small">
                        {{ user.email }}
                    </p>
                </template>
                <h3 v-else class="style-title-list">
                    {{ user.email }}
                </h3>
                <p v-if="!user.hasAccount" class="style-description-small">
                    Kan registreren
                </p>
                <p v-else-if="!user.verified" class="style-description-small">
                    E-mailadres nog niet geverifieerd
                </p>
                <p v-if="user.memberId === member.id" class="style-description-small">
                    Dit is een account van {{ member.patchedMember.firstName }} zelf
                </p>
                <p v-if="user.permissions && app !== 'registration'" class="style-description-small">
                    Heeft toegang tot beheerdersportaal
                </p>
                <template v-if="app !== 'registration' && hasWrite && user.hasAccount" #right>
                    <LoadingButton :loading="isDeletingUser(user)" class="hover-show">
                        <button type="button" class="button icon trash" @click.stop="deleteUser(user)" />
                    </LoadingButton>
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { MemberWithRegistrationsBlob, PermissionLevel, PlatformMember, User } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { useAuth } from '../../../hooks';
import { Toast } from '../../../overlays/Toast';
import { usePlatformFamilyManager } from '../../PlatformFamilyManager';

defineOptions({
    inheritAttrs: false
})
const props = defineProps<{
    member: PlatformMember
}>()
const auth = useAuth()
const app = useAppContext()
const hasWrite = computed(() => auth.canAccessPlatformMember(props.member, PermissionLevel.Write))
const deletingUsers = ref(new Set<string>())
const platformFamilyManager = usePlatformFamilyManager()

const sortedUsers = computed(() => {
    return props.member.patchedMember.users.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byBooleanValue(a.id === props.member.id, b.id === props.member.id),
            Sorter.byBooleanValue(a.hasAccount, b.hasAccount),
        )
    })
})

async function deleteUser(user: User) {
    if (deletingUsers.value.has(user.id)) {
        return
    }

    deletingUsers.value.add(user.id)

    try {
        const patch = MemberWithRegistrationsBlob.patch({id: props.member.id})
        patch.users.addDelete(user.id)

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>
        arr.addPatch(patch)
        await platformFamilyManager.isolatedPatch([props.member], arr)
    } catch (e) {
        Toast.fromError(e).show()
    }

    deletingUsers.value.delete(user.id)
}

function isDeletingUser(user: User) {
    return deletingUsers.value.has(user.id)
}
</script>
