<template>
    <section class="st-view">
        <STNavigationBar :title="$t(`d8ceaf3c-7395-4ace-9dba-f29390f07222`)" />
        <main class="center">
            <h1>
                {{ $t('6bdca00a-b7ec-413e-b57a-3e192a53564f') }}
            </h1>

            <p v-if="auth.hasPlatformFullAccess()">
                {{ $t('315fdb48-3f61-4795-9a40-c08c61fcd926') }}
            </p>
            <p v-else>
                {{ $t('607105b3-ba57-4818-9523-72923e3cdc8b') }}
            </p>
        </main>
    </section>
</template>

<script setup lang="ts">
import { useAuth } from '@stamhoofd/components';

const auth = useAuth();
</script>
