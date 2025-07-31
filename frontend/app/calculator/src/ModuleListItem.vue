<template>
    <STListItem v-if="module === ModuleType.Tickets" class="left-center right-stack" :selectable="true" element-name="label">
        <template #left>
            <Radio v-model="model" :value="module" />
        </template>

        <h3 class="style-title-list">
            Ticketverkoop
        </h3>
        <p class="style-description-small">
            Verkoop tickets voor een evenement, zoals een eetfestijn, fuif of festival. Scan de tickets snel en zonder internet met onze app.
        </p>

        <template #right>
            <img src="@stamhoofd/assets/images/illustrations/tickets.svg">
        </template>
    </STListItem>

    <STListItem v-else-if="module === ModuleType.Members" class="left-center right-stack" :selectable="true" element-name="label">
        <template #left>
            <Radio v-model="model" :value="module" />
        </template>

        <template #right>
            <img src="@stamhoofd/assets/images/illustrations/group.svg">
        </template>
        <h3 class="style-title-list">
            Ledenadministratie
        </h3>
        <p class="style-description-small">
            Beheer al je leden op één plaats, en laat hen online inschrijven als lid of voor activiteiten, via je eigen ledenportaal.
        </p>
    </STListItem>

    <STListItem v-else-if="module === ModuleType.Webshops" class="left-center right-stack" :selectable="true" element-name="label">
        <template #left>
            <Radio v-model="model" :value="module" />
        </template>

        <template #right>
            <img src="@stamhoofd/assets/images/illustrations/cart.svg">
        </template>
        <h3 class="style-title-list">
            Webshops
        </h3>
        <p class="style-description-small">
            Verkoop alle soorten zaken op je webshops, zoals T-shirts, hoodies, wafels, spaghettisaus, kerstkaartjes... Of organiseer een crowdfunding.
        </p>
    </STListItem>

    <p v-else class="style-description-small">
        Onbekend
    </p>
</template>

<script lang="ts" setup>
import { ModuleType } from './classes/ModuleType';

const props = defineProps<{
    module: ModuleType;
}>();

const model = defineModel<ModuleType>();
</script>
