<template>
    <div v-if="member.patchedMember.users.length > 0 || member.patchedMember.details.securityCode" class="hover-box container">
        <template v-if="member.patchedMember.users.length > 0">
            <hr>
            <h2 class="style-with-button">
                <span class="icon-spacer">Accounts</span>
                <a
                    v-if="!$isTouch"
                    class="button icon gray help"
                    target="_blank"
                    :href="$domains.getDocs('leden-beheren-met-meerdere-ouders')"
                />
            </h2>
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
        </template>

        <div v-if="securityCode" class="hover-box container">
            <hr>
            <h2 class="style-with-button">
                <div>Beveiligingscode</div>
                <div v-if="shouldShowResetSecurityCode">
                    <button type="button" class="button icon retry hover-show" @click="renewSecurityCode" />
                </div>
            </h2>
            <p>Gebruik deze code om een account toegang te geven tot dit lid als hun e-mailadres nog niet in het systeem zit. Deze staat ook altijd onderaan alle e-mails naar leden/ouders.</p>

            <p class="style-description">
                <code v-copyable class="style-inline-code style-copyable">{{ Formatter.spaceString(securityCode, 4, '\u2011') }}</code>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberDetails, MemberWithRegistrationsBlob, PermissionLevel, PlatformMember, User } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { useAuth } from '../../../hooks';
import { CenteredMessage } from '../../../overlays/CenteredMessage';
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
const isRenewingSecurityCode = ref(false);
const platformFamilyManager = usePlatformFamilyManager()
const $t = useTranslate();

const sortedUsers = computed(() => {
    return props.member.patchedMember.users.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byBooleanValue(a.id === props.member.id, b.id === props.member.id),
            Sorter.byBooleanValue(a.hasAccount, b.hasAccount),
        )
    })
})

const shouldShowResetSecurityCode = computed(() => {
    return auth.canAccessPlatformMember(props.member, PermissionLevel.Full);
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

const securityCode = computed(() => props.member.patchedMember.details.securityCode);

async function renewSecurityCode() {
    if(!await CenteredMessage.confirm(
        $t('Nieuwe beveiligingscode'),
        $t('Ja, resetten'),
        $t('Ben je zeker dat je een nieuwe beveiligingscode wilt genereren? De huidige code zal niet meer gebruikt kunnen worden.'))) {
        return;
    }

    if (isRenewingSecurityCode.value) {
        return
    }

    isRenewingSecurityCode.value = true;
    
    try {
        const id = props.member.id
        const patch = MemberWithRegistrationsBlob.patch({
            id,
            details: MemberDetails.patch({
                securityCode: null
            })
        });

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>
        arr.addPatch(patch)
        await platformFamilyManager.isolatedPatch([props.member], arr)
        Toast.success($t('Nieuwe beveiligingscode gegenereerd')).show()
    } catch (e) {
        Toast.fromError(e).show()
    }

    isRenewingSecurityCode.value = false;
}
</script>
