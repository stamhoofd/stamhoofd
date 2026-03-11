<template>
    <div class="st-view">
        <main class="center">
            <h1 v-if="organization">
                {{ $t('%WC') }}
            </h1>
            <h1 v-else>
                {{ $t('%Zo') }}
            </h1>
            <p v-if="organization">
                {{ $t('%Zp', {organization: organization.name}) }}
            </p>
            <p v-else>
                {{ $t('%Zq') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useOrganization } from '../hooks';

const organization = useOrganization();
</script>
