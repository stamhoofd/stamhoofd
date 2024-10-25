<template>
    <div class="container">
        <hr>
        <h2>Leveringsgebied</h2>
        <p>Voeg de gemeenten, provincies en landen toe waarin je wilt leveren.</p>

        <LoadingButton :loading="loadingSearch" class="edit-regions-search-bar block">
            <div class="input-icon-container icon search gray">
                <input v-model="searchQuery" class="input" placeholder="Toevoegen">
            </div>
        </LoadingButton>

        <STList>
            <STListItem v-for="city in cities" :key="city.id" class="right-description" :selectable="true" @click="toggleCity(city)">
                {{ city.name }} ({{ city.province.name }}, {{ countryName(city.country) }})

                <template #right>
                    <span v-if="hasCity(city)" class="icon trash" />
                    <span v-else class="icon plus" />
                </template>
            </STListItem>

            <STListItem v-for="province in provinces" :key="province.id" class="right-description" :selectable="true" @click="toggleProvince(province)">
                {{ province.name }} (provincie, {{ countryName(province.country) }})

                <template #right>
                    <span v-if="hasProvince(province)" class="icon trash" />
                    <span v-else class="icon plus" />
                </template>
            </STListItem>

            <STListItem v-for="country in countries" :key="country" class="right-description" :selectable="true" @click="toggleCountry(country)">
                {{ countryName(country) }}

                <template #right>
                    <span v-if="hasCountry(country)" class="icon trash" />
                    <span v-else class="icon plus" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { LoadingButton, STList, STListItem, useContext } from '@stamhoofd/components';
import { City, Country, CountryHelper, Province, SearchRegions, WebshopDeliveryMethod } from '@stamhoofd/structures';
import { throttle } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    deliveryMethod: WebshopDeliveryMethod;
}>();

const emits = defineEmits<{
    (e: 'patch', patch: AutoEncoderPatchType<WebshopDeliveryMethod>): void;
}>();
const context = useContext();

const searchQuery = ref('');
const throttledSearch = throttle(() => doSearch(), 300);
const loadingSearch = ref(false);
const searchResults = ref<SearchRegions | null>(null);
const searchCount = ref(0);

watch(searchQuery, (value) => {
    // start query
    loadingSearch.value = true;
    searchCount.value += 1;

    if (value.length === 0) {
        searchResults.value = null;
        loadingSearch.value = false;
        return;
    }
    throttledSearch();
});

function countryName(country: Country) {
    return CountryHelper.getName(country);
}

async function doSearch() {
    if (searchQuery.value.length === 0) {
        searchResults.value = null;
        loadingSearch.value = false;
        return;
    }

    const c = searchCount.value;

    // search
    const response = await context.value.server.request({
        method: 'GET',
        path: '/address/search',
        query: {
            query: searchQuery.value,
        },
        decoder: SearchRegions as Decoder<SearchRegions>,
    });

    if (c === searchCount.value) {
        searchResults.value = response.data;
        loadingSearch.value = false;
    }
}

const cities = computed(() => {
    if (searchResults.value) {
        return searchResults.value.cities;
    }
    return props.deliveryMethod.cities;
});

const provinces = computed(() => {
    if (searchResults.value) {
        return searchResults.value.provinces;
    }
    return props.deliveryMethod.provinces;
});

const countries = computed(() => {
    if (searchResults.value) {
        return searchResults.value.countries;
    }
    return props.deliveryMethod.countries;
});

function hasCity(city: City) {
    return !!props.deliveryMethod.cities.find(c => c.id === city.id);
}

function toggleCity(city: City) {
    const p = WebshopDeliveryMethod.patch({});

    if (hasCity(city)) {
        p.cities.addDelete(city.id);
    }
    else {
        p.cities.addPut(city);
        searchQuery.value = '';
    }

    emits('patch', p);
}

function hasProvince(province: Province) {
    return !!props.deliveryMethod.provinces.find(c => c.id === province.id);
}

function toggleProvince(province: Province) {
    const p = WebshopDeliveryMethod.patch({});

    if (hasProvince(province)) {
        p.provinces.addDelete(province.id);
    }
    else {
        p.provinces.addPut(province);
        searchQuery.value = '';
    }

    emits('patch', p);
}

function hasCountry(country: Country) {
    return !!props.deliveryMethod.countries.find(c => c === country);
}

function toggleCountry(country: Country) {
    const p = WebshopDeliveryMethod.patch({});

    if (hasCountry(country)) {
        p.countries.addDelete(country);
    }
    else {
        p.countries.addPut(country);
        searchQuery.value = '';
    }

    emits('patch', p);
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles';

.edit-regions-search-bar {
    display: block;
    margin-top: 15px;
}
</style>
