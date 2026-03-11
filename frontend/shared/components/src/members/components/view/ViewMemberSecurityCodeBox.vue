<template>
    <div v-if="securityCode" class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ $t('%wE') }}</div>
            <div v-if="shouldShowResetSecurityCode">
                <button type="button" class="button icon retry hover-show" @click="renewSecurityCode" />
            </div>
        </h2>
        <p>{{ $t('%g3') }}</p>

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
    inheritAttrs: false,
});
const props = defineProps<{
    member: PlatformMember;
}>();
const auth = useAuth();
const isRenewingSecurityCode = ref(false);
const platformFamilyManager = usePlatformFamilyManager();


const shouldShowResetSecurityCode = computed(() => {
    return auth.canAccessPlatformMember(props.member, PermissionLevel.Full);
});

const securityCode = computed(() => props.member.patchedMember.details.securityCode);

async function renewSecurityCode() {
    if (!await CenteredMessage.confirm(
        $t('%6Q'),
        $t('%6R'),
        $t('%6S'))) {
        return;
    }

    if (isRenewingSecurityCode.value) {
        return;
    }

    isRenewingSecurityCode.value = true;

    try {
        const id = props.member.id;
        const patch = MemberWithRegistrationsBlob.patch({
            id,
            details: MemberDetails.patch({
                securityCode: null,
            }),
        });

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPatch(patch);
        await platformFamilyManager.isolatedPatch([props.member], arr);
        Toast.success($t('%6T')).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    isRenewingSecurityCode.value = false;
}
</script>
