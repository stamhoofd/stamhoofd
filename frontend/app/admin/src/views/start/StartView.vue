<template>
    <section class="st-view">
        <STNavigationBar :title="$t(`Administratieportaal`)" />
        <main class="center">
            <h1>
                {{ $t('Administratieportaal') }}
            </h1>

            <p v-if="auth.hasPlatformFullAccess()">
                {{ $t('Welkom op het administratieportaal. Hier kan je alle leden of groepen opzoeken, nationale/regionale activiteiten aanmaken, of de instellingen op koepelniveau wijzigen.') }}
            </p>
            <p v-else>
                {{ $t('Welkom op het administratieportaal. Hier kan je alle leden of groepen opzoeken of nationale/regionale activiteiten aanmaken.') }}
            </p>
        </main>
    </section>
</template>

<script setup lang="ts">
import { useAuth } from '@stamhoofd/components';

const auth = useAuth();
</script>
