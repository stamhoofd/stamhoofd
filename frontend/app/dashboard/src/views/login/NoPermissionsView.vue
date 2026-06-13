<template>
    <div class="st-view">
        <STNavigationBar :large="true" />

        <main class="center">
            <h1>{{ $t('%WC') }}</h1>
            <p>{{ $t('%WD') }} {{ organization.name }}{{ $t('%WE') }}</p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';

const organization = useRequiredOrganization();
</script>
