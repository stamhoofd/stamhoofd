<template>
    <div class="st-view">
        <main class="center">
            <h1 v-if="organization">Deze pagina is voor beheerders</h1>
            <h1 v-else>Deze pagina is voor administrators</h1>
            <p v-if="organization">Oeps, deze website is enkel voor beheerders van {{ organization.name }}. Ga naar het ledenportaal als je je wilt inschrijven als lid.</p> 
            <p v-else>Oeps, deze website is enkel voor administrators. Ga naar het ledenportaal als je je wilt inschrijven als lid.</p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useOrganization } from '../hooks';

const organization = useOrganization()
</script>
