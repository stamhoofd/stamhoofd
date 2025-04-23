<template>
    <div class="st-view">
        <main class="center">
            <h1 v-if="organization">
                {{ $t('Deze pagina is voor beheerders') }}
            </h1>
            <h1 v-else>
                {{ $t('Deze pagina is voor administrators') }}
            </h1>
            <p v-if="organization">
                {{ $t('Oeps, deze website is enkel voor beheerders van {organization}. Ga naar het ledenportaal als je je wilt inschrijven als lid.', {organization: organization.name}) }}
            </p>
            <p v-else>
                {{ $t('Oeps, deze website is enkel voor administrators. Ga naar het ledenportaal als je je wilt inschrijven als lid.') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useOrganization } from '../hooks';

const organization = useOrganization();
</script>
