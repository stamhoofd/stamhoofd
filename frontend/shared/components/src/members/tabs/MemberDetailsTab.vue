<template>
    <div class="member-view-details split">
        <div>
            <ViewMemberWarningsBox v-if="isMobile" :member="member" />
            <ViewMemberGeneralBox :member="member" />
            <ViewMemberResponsibilitiesBox :member="member" />
            <ViewMemberRegistrationsBox :member="member" />
            <ViewMemberUnverifiedBox :member="member" />
            <ViewMemberNotesBox :member="member" />
            <ViewMemberParentsBox :member="member" />
            <ViewMemberEmergencyContactsBox :member="member" />
            <ViewMemberRecordCategoriesBox :member="member" />
        </div>

        <div>
            <ViewMemberWarningsBox v-if="!isMobile" :member="member" />
            <ViewMemberAccountsBox :member="member" />
            <ViewMemberFamilyBox :member="member" />
            <ViewMemberSecurityCodeBox v-if="canSeeSecurityCode" :member="member" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useIsMobile } from '#hooks/useIsMobile.ts';
import { useLoadFamily } from '#members/hooks/useLoadFamily.ts';
import type { PlatformMember } from '@stamhoofd/structures';
import { onMounted } from 'vue';
import ViewMemberAccountsBox from '#members/components/view/ViewMemberAccountsBox.vue';
import ViewMemberEmergencyContactsBox from '#members/components/view/ViewMemberEmergencyContactsBox.vue';
import ViewMemberFamilyBox from '#members/components/view/ViewMemberFamilyBox.vue';
import ViewMemberGeneralBox from '#members/components/view/ViewMemberGeneralBox.vue';
import ViewMemberNotesBox from '#members/components/view/ViewMemberNotesBox.vue';
import ViewMemberParentsBox from '#members/components/view/ViewMemberParentsBox.vue';
import ViewMemberRecordCategoriesBox from '#members/components/view/ViewMemberRecordCategoriesBox.vue';
import ViewMemberRegistrationsBox from '#members/components/view/ViewMemberRegistrationsBox.vue';
import ViewMemberSecurityCodeBox from '#members/components/view/ViewMemberSecurityCodeBox.vue';
import ViewMemberUnverifiedBox from '#members/components/view/ViewMemberUnverifiedBox.vue';
import ViewMemberWarningsBox from '#members/components/view/ViewMemberWarningsBox.vue';
import ViewMemberResponsibilitiesBox from '../components/view/ViewMemberResponsibilitiesBox.vue';
import { computed } from 'vue';
import { useUser } from '#hooks/useUser.ts';
import { useAuth } from '#hooks/useAuth.ts';

const isMobile = useIsMobile();

const props = defineProps<{
    member: PlatformMember;
}>();

const loadFamily = useLoadFamily();
const user = useUser();
const auth = useAuth();

onMounted(() => {
    loadFamily(props.member, { shouldRetry: true }).catch(console.error);
});

const canSeeSecurityCode = computed(() => {
    const isUserMember = user.value?.memberId === props.member.id;
    const responsibilities = props.member.getResponsibilities();

    const responsibilitiesFullAdmin = responsibilities.every((r) => {
        if (r.organizationId === null) {
            return auth.hasPlatformFullAccess();
        }
        return auth.hasFullAccess();
    });

    return isUserMember
        || responsibilities.length === 0
        || (responsibilities.length > 0
            && responsibilitiesFullAdmin
        )
    ;
});
</script>
