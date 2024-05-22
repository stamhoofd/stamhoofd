<template>
    <div>
        <ViewMemberRecordCategoryBox v-for="category of recordCategories" :key="category.id" :member="member" :category="category" />
    </div>
</template>

<script setup lang="ts">
import { PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAuth, useOrganization } from '../../../hooks';
import ViewMemberRecordCategoryBox from './ViewMemberRecordCategoryBox.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()

const organization = useOrganization();
const auth = useAuth();

const recordCategories = computed(() => {
    return props.member.getEnabledRecordCategories({
        checkPermissions: {
            permissions: auth.userPermissions, 
            level: PermissionLevel.Read
        },
        scopeOrganization: organization.value
    });
})

</script>
