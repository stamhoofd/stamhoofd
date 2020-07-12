<template>
    <div class="st-view group-list">
        <STNavigationBar :sticky="false">
            <template #left>
                <button v-if="canPop" class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ group ? group.name : "Alle leden" }}</span>
                    <button class="button more" />
                </STNavigationTitle>
            </template>
            <template #right>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken">

                <select v-model="selectedFilter" class="input">
                    <option v-for="(filter, index) in filters" :key="index" :value="index">
                        {{ filter.getName() }}
                    </option>
                </select>
            </template>
        </STNavigationBar>

    
        <main>
            <h1>Groepen</h1>
            <p>Hier kan je de groepen binnen jouw vereniging beheren en bewerken. Je kan instellen wie zich kan inschrijven bij welke groepen op basis van leeftijd en geslacht. Als op basis van deze restricties, leden toch in meerdere groepen passen, dan krijgen ze de keuze tijdens het inschrijven. Je kan deze daarna nog goedkeuren of verplaatsen</p>
        </main>
    </div>
</template>