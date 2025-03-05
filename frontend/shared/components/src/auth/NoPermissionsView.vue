<template>
    <div class="st-view">
        <main class="center">
            <h1 v-if="organization">{{ $t('edd3b3e5-94fb-49e4-86bd-cbb705ecca21') }}</h1>
            <h1 v-else>{{ $t('3685884b-db2b-4298-9f54-b5c0e9ad131b') }}</h1>
            <p v-if="organization">{{ $t('0327b4f1-3eb9-414b-9bb7-db00a995184f') }} {{ organization.name }}{{ $t('b0e0bba3-355a-41b9-a73b-fabe4a0057c6') }}</p> 
            <p v-else>{{ $t('b663c785-96a6-43e6-adad-1e7e39a3bbc2') }}</p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useOrganization } from '../hooks';

const organization = useOrganization()
</script>
