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
            <STListItem v-for="user in member.patchedMember.users" :key="user.id" class="hover-box">
                <template v-if="user.hasAccount && user.verified" #left>
                    <span class="icon user small" />
                </template>
                <template v-else-if="user.hasAccount && !user.verified" #left>
                    <span v-tooltip="'Deze gebruiker moet het e-mailadres nog verifiëren.'" class="icon email small" />
                </template>
                <template v-else #left>
                    <span v-tooltip="'Deze gebruiker moet eerst registreren op dit emailadres en daarbij een wachtwoord instellen.'" class="icon email small" />
                </template>

                <template v-if="user.firstName || user.lastName">
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

                <p v-if="user.permissions" class="style-description-small">
                    Beheerder
                </p>

                <template #right>
                    <button class="button icon trash hover-show" type="button" :disabled="member.isSaving" @click="unlinkUser(user)" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember, User } from '@stamhoofd/structures';
import { CenteredMessage } from '../../../overlays/CenteredMessage';
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePlatformFamilyManager } from '../../PlatformFamilyManager';
import { Toast } from '../../../overlays/Toast';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()
const platformFamilyManager = usePlatformFamilyManager();

async function unlinkUser(user: User) {
    if (!await CenteredMessage.confirm("Ben je zeker dat je de toegang tot dit lid wilt intrekken voor dit account?", "Ja, verwijderen", "Toegang intrekken van: "+user.email)) {
        return
    }

    try {
        const missing: PatchableArrayAutoEncoder<User> = new PatchableArray()
        missing.addDelete(user.id)

        props.member.addPatch({
            users: missing
        })

        await platformFamilyManager.save([props.member])
    } catch (e) {
        // Reset
        console.error(e)
        Toast.fromError(e).show()
    }
}

</script>
