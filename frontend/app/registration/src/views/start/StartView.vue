<template>
    <section class="st-view">
        <STNavigationBar title="Ledenportaal" />
        <main class="center">
            <h1>
                Ledenportaal
            </h1>

            <p>Welkom op het ledenportaal.</p>

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

</script>
