<template>
    <section class="st-view">
        <STNavigationBar :title="$t(`Administratieportaal`)"/>
        <main class="center">
            <h1>
                {{ $t('555d27a3-2b6c-44c1-ad9f-08467a3128bf') }}
            </h1>

            <p v-if="auth.hasPlatformFullAccess()">
                {{ $t('d3126dfa-e7c0-4e11-9181-12a6f690a1e7') }}
            </p>
            <p v-else>
                {{ $t('c3e488b6-5da8-4448-bdb4-850eec5f1500') }}
            </p>
        </main>
    </section>
</template>

<script setup lang="ts">
import { useAuth } from '@stamhoofd/components';

const auth = useAuth();
</script>
