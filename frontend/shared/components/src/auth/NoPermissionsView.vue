<template>
    <div class="st-view">
        <main class="center">
            <h1 v-if="organization">
                {{ $t('a7e6596c-9614-426a-a9ef-dc6e32ec2864') }}
            </h1>
            <h1 v-else>
                {{ $t('5a1f85df-8454-4cb9-bd16-bdde165a27de') }}
            </h1>
            <p v-if="organization">
                {{ $t('d25a949b-5fd1-4da9-82d0-7d82fd4bb482', {organization: organization.name}) }}
            </p>
            <p v-else>
                {{ $t('a15aada7-18bf-4c94-9165-c0f6ed539164') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useOrganization } from '../hooks';

const organization = useOrganization();
</script>
