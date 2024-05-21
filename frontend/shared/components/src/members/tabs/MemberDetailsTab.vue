<template>
    <div class="member-view-details split">
        <div>
            <ViewMemberWarningsBox v-if="isMobile" :member="member" />
            <ViewMemberGeneralBox :member="member" />
            <MemberRegistrationsBox :member="member" />
            <ViewMemberParentsBox :member="member" />
            <ViewMemberEmergencyContactsBox :member="member" />
        </div>

        <div>
            <ViewMemberWarningsBox v-if="!isMobile" :member="member" />
            <ViewMemberAccountsBox :member="member" />
            <ViewMemberFamilyBox :member="member" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useIsMobile } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import MemberRegistrationsBox from '../components/MemberRegistrationsBox.vue';
import ViewMemberAccountsBox from '../components/view/ViewMemberAccountsBox.vue';
import ViewMemberEmergencyContactsBox from '../components/view/ViewMemberEmergencyContactsBox.vue';
import ViewMemberFamilyBox from '../components/view/ViewMemberFamilyBox.vue';
import ViewMemberGeneralBox from '../components/view/ViewMemberGeneralBox.vue';
import ViewMemberParentsBox from '../components/view/ViewMemberParentsBox.vue';
import ViewMemberWarningsBox from '../components/view/ViewMemberWarningsBox.vue';

const isMobile = useIsMobile();

defineProps<{
    member: PlatformMember
}>();

</script>
