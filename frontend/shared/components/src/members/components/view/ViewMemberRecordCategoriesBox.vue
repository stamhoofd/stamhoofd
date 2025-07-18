<template>
    <div>
        <ViewMemberRecordCategoryBox v-for="category of recordCategories.categories" :key="category.id" :member="member" :category="category" :is-admin="recordCategories.adminPermissionsMap.get(category.id) ?? false" />
    </div>
</template>

<script setup lang="ts">
import { PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAuth, useOrganization } from '../../../hooks';
import ViewMemberRecordCategoryBox from './ViewMemberRecordCategoryBox.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();

const auth = useAuth();
const organization = useOrganization();

const recordCategories = computed(() => {
    const checkPermissions = {
        user: auth.user!,
        level: PermissionLevel.Read,
    };

    const member = props.member;
    return member.getEnabledRecordCategories({
        checkPermissions,
        scopeOrganization: organization.value,
    });
});

</script>
