<!-- eslint-disable vue/no-multiple-template-root -->
<template>
    <LoadingViewTransition :error-box="errorBox">
        <slot v-if="!loading" v-bind="{externalOrganization: externalOrganization as null extends Nullable ? (Organization|null) : Organization}" />
    </LoadingViewTransition>
</template>

<script setup lang="ts" generic="Nullable extends string|null">
import { Organization } from '@stamhoofd/structures';
import { computed, watchEffect } from 'vue';
import { useExternalOrganization } from '../groups';
import LoadingViewTransition from './LoadingViewTransition.vue';

const props = defineProps<{
    organizationId: Nullable;
}>()

const emit = defineEmits<{
    update: [patch: Organization]
}>()
const {loading, errorBox, externalOrganization} = useExternalOrganization(computed(() => props.organizationId))

watchEffect(() => {
    if (externalOrganization.value) {
        emit('update', externalOrganization.value)
    }
})

</script>
