<template>
    <section class="st-view start-view">
        <STNavigationBar title="Beheerdersportaal"></STNavigationBar>
        <main class="center">
            <h1>
                Beheerdersportaal
            </h1>

            <p>Welkom op het beheerdersportaal. Hier kan je jouw vereniging beheren en instellingen aanpassen.</p>

            <div class="container">
                <hr>
                <h2>
                    Snelle acties
                </h2>

                <STList>
                    <STListItem>
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/cart.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            Nieuwe verkoop starten
                        </h3>
                        <p class="style-description-small">
                            Een ticketverkoop, openbare inschrijvingen voor een evenement of een gewone webshop maken.
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>

                    <STListItem>
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/gear.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            Instellingen beheren
                        </h3>
                        <p class="style-description-small">
                            Beheer de instellingen van je vereniging
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { onActivated, onMounted } from 'vue';
import { useUrl } from '@simonbackx/vue-app-navigation';

const urlHelpers = useUrl();

onActivated(() => {
    console.log('Start view mounted');
    urlHelpers.setTitle('Beheerdersportaal');
});
</script>

<style lang="scss">
    .start-view {
    }
</style>