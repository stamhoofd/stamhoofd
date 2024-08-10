<template>
    <div class="member-view-details split">
        <div>
            <ViewMemberWarningsBox v-if="isMobile" :member="member" />
            <ViewMemberGeneralBox :member="member" />
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
        </div>
    </div>
</template>

<script setup lang="ts">
import { useIsMobile, usePlatformFamilyManager } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import { onMounted } from 'vue';
import { ViewMemberAccountsBox, ViewMemberEmergencyContactsBox, ViewMemberFamilyBox, ViewMemberGeneralBox, ViewMemberNotesBox, ViewMemberParentsBox, ViewMemberRecordCategoriesBox, ViewMemberRegistrationsBox, ViewMemberUnverifiedBox, ViewMemberWarningsBox } from '../components/view';

const isMobile = useIsMobile();

const props = defineProps<{
    member: PlatformMember
}>();

const platformFamilyManager = usePlatformFamilyManager();

onMounted(() => {
    platformFamilyManager.loadFamilyMembers(props.member, {shouldRetry: true}).catch(console.error)
});
</script>
