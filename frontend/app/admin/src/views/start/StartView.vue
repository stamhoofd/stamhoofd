<template>
    <section class="st-view">
        <STNavigationBar title="Administratieportaal" />
        <main class="center">
            <h1>
                Administratieportaal
            </h1>

            <p v-if="auth.hasPlatformFullAccess()">
                Welkom op het administratieportaal. Hier kan je alle leden of groepen opzoeken, nationale/regionale activiteiten aanmaken, of de instellingen op koepelniveau wijzigen.
            </p>
            <p v-else>
                Welkom op het administratieportaal. Hier kan je alle leden of groepen opzoeken of nationale/regionale activiteiten aanmaken.
            </p>
        </main>
    </section>
</template>

<script setup lang="ts">
import { useAuth } from '@stamhoofd/components';

const auth = useAuth();
</script>
