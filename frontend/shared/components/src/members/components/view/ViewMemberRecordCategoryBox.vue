<template>
    <div class="hover-box container">
        <hr>
        todo
    </div>
</template>

<script setup lang="ts">
import { Parent, PlatformMember, ParentTypeHelper } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false
})

defineProps<{
    parent: Parent,
    member: PlatformMember
}>()

const currentCountry = useCountry();

</script>
