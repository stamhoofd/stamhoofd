<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Activiteiten">
            <template #right>
                <button type="button" class="button icon add navigation" @click="addEvent" />
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>
                Activiteiten
            </h1>
            <p>Voeg evenementen of activiteiten toe aan je kalender waarvoor leden al dan niet kunnen inschrijven via het ledenportaal.</p>

            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">Filter</span>
                        <span v-if="filteredCount > 0" class="bubble primary">{{ formatInteger(filteredCount) }}</span>
                    </button>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ref } from 'vue';
import EditEventView from './EditEventView.vue';
import { Event } from '@stamhoofd/structures';


const searchQuery = ref('');
const filteredCount = ref(0);
const present = usePresent()

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur()
}

async function addEvent() {
    const event = Event.create({})

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventView, {
                event,
                isNew: true
            })
        ]
    })
}

function editFilter() {
    // todo
}

</script>
