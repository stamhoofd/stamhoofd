<template>
    <div class="member-view-details split">
        <div>
            <ViewMemberWarningsBox v-if="isMobile" :member="member" />
            <ViewMemberGeneralBox :member="member" />
            <MemberRegistrationsBox :member="member" />
            <ViewMemberParentsBox :member="member" />
            <ViewMemberEmergencyContactsBox :member="member" />
            <ViewMemberRecordCategoriesBox :member="member" />
            <ViewMemberNotesBox :member="member"/>
            <ViewMemberUncategorizedBox :member="member" />
        </div>

        <div>
            <ViewMemberWarningsBox v-if="!isMobile" :member="member" />
            <ViewMemberAccountsBox :member="member" />
            <ViewMemberFamilyBox :member="member" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useIsMobile, usePlatformFamilyManager } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import { onMounted } from 'vue';
import MemberRegistrationsBox from '../components/MemberRegistrationsBox.vue';
import ViewMemberAccountsBox from '../components/view/ViewMemberAccountsBox.vue';
import ViewMemberEmergencyContactsBox from '../components/view/ViewMemberEmergencyContactsBox.vue';
import ViewMemberFamilyBox from '../components/view/ViewMemberFamilyBox.vue';
import ViewMemberGeneralBox from '../components/view/ViewMemberGeneralBox.vue';
import ViewMemberNotesBox from '../components/view/ViewMemberNotesBox.vue';
import ViewMemberParentsBox from '../components/view/ViewMemberParentsBox.vue';
import ViewMemberRecordCategoriesBox from '../components/view/ViewMemberRecordCategoriesBox.vue';
import ViewMemberUncategorizedBox from '../components/view/ViewMemberUncategorizedBox.vue';
import ViewMemberWarningsBox from '../components/view/ViewMemberWarningsBox.vue';

const isMobile = useIsMobile();

const props = defineProps<{
    member: PlatformMember
}>();

const platformFamilyManager = usePlatformFamilyManager();

onMounted(() => {
    platformFamilyManager.loadFamilyMembers(props.member, {shouldRetry: true}).catch(console.error)
});
</script>
