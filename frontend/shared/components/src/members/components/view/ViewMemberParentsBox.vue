<template>
    <div>
        <ViewMemberParentBox v-for="parent of member.patchedMember.details.parents" :key="parent.id" :member="member" :parent="parent" />
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import ViewMemberParentBox from './ViewMemberParentBox.vue';

defineOptions({
    inheritAttrs: false
})

defineProps<{
    member: PlatformMember
}>()

</script>
