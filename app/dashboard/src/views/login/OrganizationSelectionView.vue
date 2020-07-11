<template>
    <div class="organization-selection-view">
        <h1>Kies je vereniging</h1>
        <p>Selecteer de vereniging waar je wilt inloggen.</p>
        <input v-model="query" class="input search" placeholder="Zoek op postcode of naam">

        <Spinner v-if="loading" class="gray center" />
        <template v-else>
            <button v-for="organization in filteredResults" :key="organization.id" class="search-result" @click="loginOrganization(organization)">
                <h1>{{ organization.name }}</h1>
                <p>{{ organization.address }}</p>
                <p v-if="isSignedInFor(organization)">
                    Ingelogd
                </p>
            </button>
        </template>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import Spinner from "@stamhoofd/components/src/Spinner.vue";
import { NetworkManager,SessionManager } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import LoginView from './LoginView.vue';

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        Spinner
    }
})
export default class OrganizationSelectionView extends Mixins(NavigationMixin){
    loading = false;
    q = ""
    results: Organization[] = []

    get query() {
        return this.q
    }

    set query(query: string) {
        this.q = query

        // update
        this.startUpdateResults();
    }

    mounted() {
        console.log("mounted organization selection")
    }

    throttleUpdateResults = throttle(this.updateResults.bind(this), 1000);

    get defaultOrganizations() {
        return SessionManager.availableSessions().map(s => s.organization)
    }

    get filteredResults() {
        if (this.query.length == 0) {
            return this.defaultOrganizations
        }
        return this.results
    }

    startUpdateResults() {
        this.loading = true
        this.throttleUpdateResults()
    }

    updateResults() {
        if (this.query.length == 0) {
            this.results = []
            this.loading = false
            return
        }
        this.loading = true
        NetworkManager.server.request({
            method: "GET",
            path: "/organizations/search",
            query: {query: this.query },
            decoder: new ArrayDecoder(Organization as Decoder<Organization>)
        }).then((response) => {
            this.results = response.data
        }).catch(e => {
            console.error(e)
            this.results = []
        }).finally(() => {
            this.loading = false
        })
    }

    loginOrganization(organization: Organization) {
        const session = SessionManager.getSessionForOrganization(organization.id)
        if (session && session.hasToken()) {
            SessionManager.setCurrentSession(session)
            return
        }
        this.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(LoginView, { organization }) }).setDisplayStyle("sheet"))
    }

    isSignedInFor(organization: Organization) {
        const session = SessionManager.getSessionForOrganization(organization.id)
        return session && session.hasToken()
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

    .organization-selection-view {
        padding: 20px;
        padding-top: 100px;

        max-width: 400px;
        margin: 0 auto;

        > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 10px;
        }

        > p {
            @extend .style-description;
        }

        > .spinner-container {
            padding: 10px 0;
        }

        > .search-result {
            @extend .style-input-shadow;
            background: $color-white url('~@stamhoofd/assets/images/icons/gray/arrow-right-small.svg') right 10px center no-repeat;
            border: $border-width solid $color-gray-light;
            padding: 20px 20px;
            border-radius: $border-radius;
            margin: 10px 0;
            transition: transform 0.2s, border-color 0.2s;
            cursor: pointer;
            touch-action: manipulation;
            user-select: none;
            display: block;
            width: 100%;
            text-align: left;

            > h1 {
                @extend .style-title-3;
                padding-bottom: 2px;
            }

            > p {
                @extend .style-description;
            }

            &:hover {
                border-color: $color-primary-gray-light;
            }


            &:active {
                transform: scale(0.95, 0.95);
                border-color: $color-primary;
            }
        }
    }
</style>
