<template>
    <div v-if="member.patchedMember.users.length > 0" class="hover-box container">
        <hr>
        <h2 class="style-with-button">
            <span class="icon-spacer">Accounts</span>
            <a 
                v-if="!$isTouch"
                class="button icon gray help"
                target="_blank"
                :href="'https://'+$t('shared.domains.marketing')+'/docs/leden-beheren-met-meerdere-ouders/'"
            />
        </h2>

        <STList>
            <STListItem v-for="user in sortedUsers" :key="user.id" class="hover-box" :selectbale="true" @click="editUser(user)">
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

                <p v-if="user.permissions" class="style-description-small">
                    Heeft toegang tot beheerdersportaal
                </p>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { PlatformMember, User, UserWithMembers } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import EditAdminView from '../../../admins/EditAdminView.vue';
import { useContext } from '../../../hooks';
import { Toast } from '../../../overlays/Toast';

defineOptions({
    inheritAttrs: false
})
const props = defineProps<{
    member: PlatformMember
}>()
const context = useContext();
const present = usePresent();
const editingUser = ref(new Set())

const sortedUsers = computed(() => {
    return props.member.patchedMember.users.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byBooleanValue(a.id === props.member.id, b.id === props.member.id),
            Sorter.byBooleanValue(a.hasAccount, b.hasAccount),
        )
    })
})

async function editUser(user: User) {
    if (editingUser.value.has(user.id)) {
        return
    }
    editingUser.value.add(user.id)
    // First load the specific user
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/user/${user.id}`,
            decoder: UserWithMembers as Decoder<UserWithMembers>
        })

        const userWithMembers = response.data;
        await present({
            components: [
                new ComponentWithProperties(EditAdminView, {
                    user: userWithMembers,
                    isNew: false
                })
            ],
            modalDisplayStyle: 'popup'
        })
    } catch (e) {
        Toast.fromError(e).show()
    }
    editingUser.value.delete(user.id)
}
</script>
