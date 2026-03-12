<template>
    <section class="st-view">
        <STNavigationBar :title="$t(`%IW`)" />
        <main class="center">
            <h1>
                {{ $t('%IW') }}
            </h1>

            <p v-if="auth.hasPlatformFullAccess()">
                {{ $t('%IX') }}
            </p>
            <p v-else>
                {{ $t('%IY') }}
            </p>
        </main>
    </section>
</template>

<script setup lang="ts">
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';

const auth = useAuth();
</script>
