<template>
    <div class="container">
        <hr>
        <h2>Leveringsgebied</h2>
        <p>Voeg de gemeenten, provincies en landen toe waarin je wilt leveren.</p>

        <LoadingButton :loading="loadingSearch" class="edit-regions-search-bar block">
            <div class="input-icon-container icon search gray">
                <input v-model="searchQuery" class="input" placeholder="Toevoegen" @input="searchQuery = $event.target.value">
            </div>
        </LoadingButton>
    
        <STList>
            <STListItem v-for="city in cities" :key="city.id" class="right-description" :selectable="true" @click="toggleCity(city)">
                {{ city.name }} ({{ city.province.name }}, {{ countryName(city.country) }})

                <template slot="right">
                    <span v-if="hasCity(city)" class="icon trash" />
                    <span v-else class="icon plus" />
                </template>
            </STListItem>

            <STListItem v-for="province in provinces" :key="province.id" class="right-description" :selectable="true" @click="toggleProvince(province)">
                {{ province.name }} (provincie, {{ countryName(province.country) }})

                <template slot="right">
                    <span v-if="hasProvince(province)" class="icon trash" />
                    <span v-else class="icon plus" />
                </template>
            </STListItem>

            <STListItem v-for="country in countries" :key="country" class="right-description" :selectable="true" @click="toggleCountry(country)">
                {{ countryName(country) }}

                <template slot="right">
                    <span v-if="hasCountry(country)" class="icon trash" />
                    <span v-else class="icon plus" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LoadingButton,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { City, Country, CountryHelper, Province, SearchRegions, WebshopDeliveryMethod } from "@stamhoofd/structures"
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();
            
        lastFunc = setTimeout(function() {
            if (Date.now() - lastRan >= limit) {
                func.apply(context, args);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STListItem,
        STList,
        LoadingButton
    }
})
export default class EditDeliveryregionsSection extends Mixins(NavigationMixin) {
  
    @Prop({ required: true })
    deliveryMethod!: WebshopDeliveryMethod

    searchQuery = ""
    throttledSearch = throttle(this.doSearch.bind(this), 300);
    loadingSearch = false
    searchResults: SearchRegions | null = null
    searchCount = 0

    @Watch('searchQuery')
    onSearch() {
        // start query
        this.loadingSearch = true
        this.searchCount++;

         if (this.searchQuery.length == 0) {
            this.searchResults = null
            this.loadingSearch = false
            return
        }
        this.throttledSearch()
    }

    countryName(country: Country) {
        return CountryHelper.getName(country)
    }

    async doSearch() {
        if (this.searchQuery.length == 0) {
            this.searchResults = null
            this.loadingSearch = false
            return
        }

        const c = this.searchCount

        // search
        const response = await SessionManager.currentSession!.server.request({
            method: "GET",
            path: "/address/search",
            query: {
                query: this.searchQuery
            },
            decoder: SearchRegions as Decoder<SearchRegions>
        })

        if (c === this.searchCount) {
            this.searchResults = response.data
            this.loadingSearch = false
        }
    }

    addPatch(patch: AutoEncoderPatchType<WebshopDeliveryMethod>) {
        this.$emit("patch", patch)
    }

    get cities() {
        if (this.searchResults) {
            return this.searchResults.cities
        }
        return this.deliveryMethod.cities
    }

    get provinces() {
        if (this.searchResults) {
            return this.searchResults.provinces
        }
        return this.deliveryMethod.provinces
    }

    get countries() {
        if (this.searchResults) {
            return this.searchResults.countries
        }
        return this.deliveryMethod.countries
    }
   
    hasCity(city: City) {
        return !!this.deliveryMethod.cities.find(c => c.id == city.id)
    }

    toggleCity(city: City) {
        const p = WebshopDeliveryMethod.patch({})

        if (this.hasCity(city)) {
            p.cities.addDelete(city.id)
        } else {
            p.cities.addPut(city)
        }

        this.$emit('patch', p)
    }

    hasProvince(province: Province) {
        return !!this.deliveryMethod.provinces.find(c => c.id == province.id)
    }

    toggleProvince(province: Province) {
        const p = WebshopDeliveryMethod.patch({})

        if (this.hasProvince(province)) {
            p.provinces.addDelete(province.id)
        } else {
            p.provinces.addPut(province)
        }

        this.$emit('patch', p)
    }

    hasCountry(country: Country) {
        return !!this.deliveryMethod.countries.find(c => c == country)
    }

    toggleCountry(country: Country) {
        const p = WebshopDeliveryMethod.patch({})

        if (this.hasCountry(country)) {
            p.countries.addDelete(country)
        } else {
            p.countries.addPut(country)
        }

        this.$emit('patch', p)
    }
    
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles';

.edit-regions-search-bar {
    display: block;
    margin-top: 15px;
}
</style>
