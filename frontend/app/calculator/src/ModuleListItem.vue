<template>
    <STListItem v-if="module === ModuleType.Tickets" class="left-center" :selectable="true">
        <template #left>
            <img src="@stamhoofd/assets/images/illustrations/tickets.svg">
        </template>
        <h3 class="style-title-list">
            Ticketverkoop
        </h3>
        <p class="style-description-small">
            Je verkoopt tickets voor een evenement, zoals een eetfestijn, fuif of festival
        </p>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>

    <STListItem v-else-if="module === ModuleType.Members" class="left-center" :selectable="true">
        <template #left>
            <img src="@stamhoofd/assets/images/illustrations/group.svg">
        </template>
        <h3 class="style-title-list">
            Ledenadministratie
        </h3>
        <p class="style-description-small">
            Beheer al je leden op één plaats, en laat hen online inschrijven.
        </p>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>

    <STListItem v-else-if="module === ModuleType.Webshops" class="left-center" :selectable="true">
        <template #left>
            <img src="@stamhoofd/assets/images/illustrations/cart.svg">
        </template>
        <h3 class="style-title-list">
            Webshops
        </h3>
        <p class="style-description-small">
            Verkoop alle soorten zaken op je webshops.
        </p>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
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
</script>
