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
            <ViewMemberSecurityCodeBox :member="member" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useIsMobile, useLoadFamily } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import { onMounted } from 'vue';
import { ViewMemberAccountsBox, ViewMemberEmergencyContactsBox, ViewMemberFamilyBox, ViewMemberGeneralBox, ViewMemberNotesBox, ViewMemberParentsBox, ViewMemberRecordCategoriesBox, ViewMemberRegistrationsBox, ViewMemberSecurityCodeBox, ViewMemberUnverifiedBox, ViewMemberWarningsBox } from '../components/view';
import ViewMemberResponsibilitiesBox from '../components/view/ViewMemberResponsibilitiesBox.vue';

const isMobile = useIsMobile();

const props = defineProps<{
    member: PlatformMember;
}>();

const loadFamily = useLoadFamily();

onMounted(() => {
    loadFamily(props.member, { shouldRetry: true }).catch(console.error);
});
</script>
