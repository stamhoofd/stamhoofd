<template>
    <p v-if="missingScopes.length > 0" class="warning-box with-button selectable" @click="emit('reconnect')">
        {{ $t('%Zqd') }}

        <button class="button text" type="button">
            {{ $t('%ZqJ') }}
        </button>
    </p>
</template>

<script setup lang="ts">
import { useOrganization } from '#hooks/useOrganization.ts';
import { computed } from 'vue';

const emit = defineEmits<{ reconnect: [] }>();

const organization = useOrganization();
const missingScopes = computed(() => organization.value?.privateMeta?.mollieOnboarding?.missingScopes ?? []);
</script>
