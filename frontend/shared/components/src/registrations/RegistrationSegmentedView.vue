<template>
    <MemberSegmentedView :member="registration.member" :initial-tab="initialTab" :group="group" :get-next="getNext" :get-previous="getPrevious" />
</template>

<script lang="ts" setup>
import { Group, PlatformMember, PlatformRegistration } from '@stamhoofd/structures';
import MemberSegmentedView from '../members/MemberSegmentedView.vue';

type PropType = {
    registration: PlatformRegistration;
    initialTab?: number | null;
    group?: Group | null;
    getNext: (current: PlatformMember) => PlatformMember | null;
    getPrevious: (current: PlatformMember) => PlatformMember | null;
};

withDefaults(
    defineProps<PropType>(),
    {
        initialTab: null,
        group: null,
    },
);
</script>
