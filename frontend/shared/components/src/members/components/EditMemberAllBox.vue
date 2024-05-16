<template>
    <div>
        <EditMemberGeneralBox v-bind="$attrs" :member="member" />

        <div v-if="member.isPropertyEnabled('parents')" class="container">
            <hr>
            <h2>Ouders</h2>
            <EditMemberParentsBox v-bind="$attrs" :member="member" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';

import EditMemberGeneralBox from './EditMemberGeneralBox.vue';
import EditMemberParentsBox from './EditMemberParentsBox.vue';

defineOptions({
  inheritAttrs: false
})

defineProps<{
    member: PlatformMember,
}>();

</script>
