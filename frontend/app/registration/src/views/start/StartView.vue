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

                <STList class="illustration-list">
                    <STListItem class="left-center" :selectable="true" @click="registerMembers">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            Lid inschrijven
                        </h3>
                        <p class="style-description-small">
                            Schrijf een lid in
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
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';

enum Routes {
    RegisterMembers = 'registerMembers',
}
defineRoutes([
    {
        name: Routes.RegisterMembers,
        url: 'registreren',
        component: async () => (await import('../members/RegisterMembersView.vue')).default as any,
        present: 'popup'
    }
])
const $navigate = useNavigate();

async function registerMembers() {
    await $navigate(Routes.RegisterMembers);
}
</script>
