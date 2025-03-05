<template>
    <div v-if="securityCode" class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ $t('188afef4-7116-41b8-ab40-ccb879da1756') }}</div>
            <div v-if="shouldShowResetSecurityCode">
                <button type="button" class="button icon retry hover-show" @click="renewSecurityCode"/>
            </div>
        </h2>
        <p>{{ $t('b3905b67-dc63-4f4f-8039-6ef17e5ba7a3') }}</p>

        <p class="style-description">
            <code v-copyable class="style-inline-code style-copyable">{{ Formatter.spaceString(securityCode, 4, '\u2011') }}</code>
        </p>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberDetails, MemberWithRegistrationsBlob, PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
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
const isRenewingSecurityCode = ref(false);
const platformFamilyManager = usePlatformFamilyManager()
const $t = useTranslate();

const shouldShowResetSecurityCode = computed(() => {
    return auth.canAccessPlatformMember(props.member, PermissionLevel.Full);
})

const securityCode = computed(() => props.member.patchedMember.details.securityCode);

async function renewSecurityCode() {
    if(!await CenteredMessage.confirm(
        $t('db2fa1f9-4a3d-4f03-ad7d-fba479452d14'),
        $t('3341eabb-512a-40f9-8679-6420ae92f1c6'),
        $t('d9870397-d89a-47ec-8ae6-0601e49b9116'))) {
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
        Toast.success($t('0c427a9d-2485-498f-bb88-a420843745f4')).show()
    } catch (e) {
        Toast.fromError(e).show()
    }

    isRenewingSecurityCode.value = false;
}
</script>
