<template>
    <section class="st-view">
        <STNavigationBar title="Ledenportaal" />
        <main class="center">
            <h1>
                Ledenportaal
            </h1>

            <p>Welkom op het ledenportaal.</p>

            <template v-if="members.length == 0 && isAcceptingNewMembers">
                <button class="button primary" type="button" @click="registerMembers">
                    <span class="icon edit" />
                    <span>Schrijf een lid in</span>
                </button>
            </template>

            <div v-else class="container">
                <hr>
                <h2>
                    Algemeen
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

                    <STListItem class="left-center" :selectable="true" @click="checkData">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/magnifier.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            Gegevens nakijken
                        </h3>
                        <p class="style-description-small">
                            Pas gegevens aan en bekijk al jouw inschrijvingen
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
import { useMemberManager } from '../../getRootView';
import { computed } from 'vue';

enum Routes {
    RegisterMembers = 'registerMembers',
    CheckData = 'checkData'
}
defineRoutes([
    {
        name: Routes.RegisterMembers,
        url: 'registreren',
        component: async () => (await import('../members/RegisterMembersView.vue')).default as any,
        present: 'popup'
    },
    {
        name: Routes.CheckData,
        url: 'gegevens',
        component: async () => (await import('../members/CheckDataView.vue')).default as any,
        present: 'popup'
    }
])
const $navigate = useNavigate();
const memberManager = useMemberManager();

const members = computed(() => memberManager.family.members);
const isAcceptingNewMembers = computed(() => memberManager.isAcceptingNewMembers);

async function registerMembers() {
    await $navigate(Routes.RegisterMembers);
}

async function checkData() {
    await $navigate(Routes.CheckData);
}

</script>
