<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t('Inspiratie')" />

        <main class="center">
            <h1>
                {{ $t('Inspiratie voor Webshops') }}
            </h1>

            <p>{{ $t("Hier vind je inspiratie voor de volgende webshop van je vereniging. Als je op een idee klikt krijg je meer informatie zoals interessante links.") }}</p>

            <ScrollableSegmentedControl v-model="selectedLabel" :items="labelValues" :labels="labels" />

            <STList>
                <WebshopIdeaRow v-for="idea of selectedIdeas" :key="idea.id" :idea="idea" />
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ScrollableSegmentedControl } from '@stamhoofd/components';
import { WebshopIdea } from '@stamhoofd/structures';
import { computed, ref, Ref } from 'vue';
import WebshopIdeaRow from './WebshopIdeaRow.vue';

const selectedLabel = ref(null) as Ref<WebshopIdeaLabel | null>;

enum WebshopIdeaLabel {
    Classic = 'Klassiek',
    Original = 'Origineel',
    Seasonal = 'Seizoensgebonden',
    Food = 'Eten',
    Culture = 'Cultuur',
    Sport = 'Sport',
    Event = 'Activiteit',
    ProductSales = 'Productverkoop',
    Other = 'Overig',
    Sponsored = 'Gesponserd',

}

const labelValues: (WebshopIdeaLabel | null)[] = [null, WebshopIdeaLabel.Classic, WebshopIdeaLabel.Original, WebshopIdeaLabel.Seasonal, WebshopIdeaLabel.Sponsored];
const labels = labelValues.map(l => l ?? 'Alles');

const ideas: WebshopIdea[] = [
    WebshopIdea.create({
        name: 'Fuif',
        description: 'Een fuif organiseren is altijd leuk voor jongeren. Heb je geen idee hoe je een fuif organiseert? Bezoek dan zeker ikorganiseer.be',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Event],
    }),
    WebshopIdea.create({
        name: 'Eetfestijn',
        description: 'Verkoop tickets voor een eetfestijn. De opties zijn eindeloos. Klassiekers zijn: een barbecue, spagehettiavond, mosselfestijn, brunch, ontbijt of een kaas- en wijnavond.',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Event, WebshopIdeaLabel.Food],
    }),
    WebshopIdea.create({
        name: 'Zoetighedenverkoop',
        description: 'Verkoop zelfgemaakte lekkernijen zoals wafels, koekjes of taarten.',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Food, WebshopIdeaLabel.ProductSales],
    }),
    WebshopIdea.create({
        name: 'Wandel- of fietstocht',
        description: 'Organiseer een ontspannende wandel- of fietstocht.',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Event, WebshopIdeaLabel.Sport],
    }),
    WebshopIdea.create({
        name: 'Crowdfunding',
        description: 'Verkoop steuntickets voor een specifiek project.',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Other],

    }),
    WebshopIdea.create({
        name: 'Filmavond',
        description: 'Verkoop tickets voor een filmvoorstelling.',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Event, WebshopIdeaLabel.Culture],
    }),
    WebshopIdea.create({
        name: 'Quiz',
        description: 'Voor slimmeriken.',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Event],
    }),
    WebshopIdea.create({
        name: 'Halloweentocht',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Event, WebshopIdeaLabel.Seasonal],
    }),
    WebshopIdea.create({
        name: 'Paasbrunch',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Event, WebshopIdeaLabel.Seasonal, WebshopIdeaLabel.Food],
    }),
    WebshopIdea.create({
        name: 'Bloemenverkoop voor moederdag',
        labels: [WebshopIdeaLabel.Classic, WebshopIdeaLabel.Event, WebshopIdeaLabel.Seasonal, WebshopIdeaLabel.ProductSales],
    }),
    WebshopIdea.create({
        name: 'Toneelvoorstelling',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Event, WebshopIdeaLabel.Culture],
    }),
    WebshopIdea.create({
        name: 'Muziekconcert',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Event, WebshopIdeaLabel.Culture],
    }),
    WebshopIdea.create({
        name: 'Fototentoonstelling',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Event, WebshopIdeaLabel.Culture],
    }),
    WebshopIdea.create({
        name: 'Spookhuis',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Event, WebshopIdeaLabel.Seasonal],
    }),
    WebshopIdea.create({
        name: 'Escape room',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Event],
    }),
    WebshopIdea.create({
        name: 'Workshop',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Other, WebshopIdeaLabel.Event],
    }),
    WebshopIdea.create({
        name: 'Silent disco',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Event],
    }),
    WebshopIdea.create({
        name: 'Drive-thru voedselafhaling',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Food],
    }),
    WebshopIdea.create({
        name: 'Sporttoernooi',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Sport, WebshopIdeaLabel.Event],
    }),
    WebshopIdea.create({
        name: 'Verkoop koffie van "onderneming x"',
        description: '...',
        labels: [WebshopIdeaLabel.Original, WebshopIdeaLabel.Food, WebshopIdeaLabel.ProductSales, WebshopIdeaLabel.Sponsored],
    }),
];

const selectedIdeas = computed(() => {
    const selected = selectedLabel.value;

    if (selected === null) {
        return ideas;
    }
    return ideas.filter(i => i.labels.includes(selected));
});

</script>
