<template>
    <LoadingView v-if="loadingDefault" />
    <div v-else>
        <STGradientBackground />

        <div class="st-view background transparent">
            <STNavigationBar v-if="!isNative" :large="true" class="transparent">
                <template #left>
                    <a alt="Stamhoofd" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener" class="logo-container">
                        <Logo class="responsive" />
                        <span class="logo-text horizontal hide-medium">Beheerders</span>
                    </a>
                </template>

                <template #right>
                    <template v-if="$context.user">
                        <InheritComponent name="tabbar-right" />
                    </template>
                    <template v-else>
                        <a v-if="!isNative" class="button text only-icon-smartphone" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener">
                            <span class="icon external" />
                            <span>Terug naar website</span>
                        </a>

                        <a v-if="!isNative" class="button primary" href="/aansluiten" @click.prevent="$navigate('join')">
                            {{ $t("dashboard.join") }}
                        </a>
                    </template>
                </template>
            </STNavigationBar>
            <STNavigationBar v-else title="Beheer jouw vereniging" class="transparent" />

            <main class="limit-width">
                <div class="organization-selection-view" :class="{native: isNative}">
                    <h1 v-if="!isPlatform">
                        Beheer jouw vereniging
                    </h1>
                    <h1 v-else>
                        Zoek jouw lokale groep
                    </h1>

                    <p v-if="!isNative" class="style-description-block style-description-large">
                        Welkom op het dashboard voor beheerders van verenigingen op Stamhoofd. Als jouw vereniging als is aangesloten bij Stamhoofd, kan je die hieronder zoeken.
                    </p>
                    <p v-else class="style-description-block style-description-large">
                        Welkom in de Stamhoofd app voor beheerders. Als jouw vereniging al is aangesloten bij Stamhoofd, kan je die hieronder zoeken.
                    </p>

                    <form class="input-icon-container icon search gray" @submit.prevent>
                        <input ref="input" v-model="query" autofocus class="input" placeholder="Zoek op naam of postcode" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" @keydown.down.prevent="focusResult(0)">
                    </form>

                    <div v-if="showDevelopment" class="version-box">
                        <VersionFooter />
                    </div>
                    <Spinner v-else-if="loadingResults" class="gray center" />
                    <template v-else>
                        <button v-for="(option, index) in visibleOptions" ref="resultElements" :key="option.id" type="button" class="search-result" @keydown.down.prevent="focusResult(index + 1)" @keydown.up.prevent="focusResult(index - 1)" @click="selectOption(option)">
                            <ContextLogo :organization="option.organization" :app="option.app" />
                            <div>
                                <h1>{{ getAppTitle(option.app, option.organization) }}</h1>

                                <p v-if="getAppDescription(option.app, option.organization)" class="style-description">
                                    {{ getAppDescription(option.app, option.organization) }}
                                </p>
                                <p v-if="option.userDescription" class="style-description-small style-em">
                                    Ingelogd als {{ option.userDescription }}
                                </p>
                                
                                <span v-if="option.userDescription" class="icon gray sync floating" />
                                <span v-if="!isPlatform && option.context.canGetCompleted()" class="icon success primary floating" />
                                <span v-if="isPlatform && option.context.hasPermissions()" class="icon privacy gray floating" />
                            </div>
                        </button>
                    </template>

                    <p v-if="!loadingResults && visibleOptions.length == 0 && query && !showDevelopment" class="info-box">
                        Geen verenigingen gevonden. Probeer te zoeken op postcode of naam. Is jouw vereniging nog niet aangesloten? Maak dan eerst een vereniging aan.
                    </p>

                    <footer v-if="!showDevelopment && !isPlatform">
                        <a v-if="!isNative" href="/aansluiten" class="button text full selected" @click.prevent="$navigate('join')">
                            <span class="icon add" />
                            <span>Mijn vereniging aansluiten</span>
                        </a>

                        <button class="button text full" type="button" @click="help">
                            <span class="icon help" />
                            <span>Mijn vereniging staat er niet tussen</span>
                        </button>
                    </footer>
                </div>
            </main>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { ContextLogo, getAppDescription, getAppTitle, InheritComponent, Logo, Option, Spinner, STGradientBackground, Toast, useContextOptions, useUser } from '@stamhoofd/components';
import { AppManager, NetworkManager, useRequestOwner } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import {throttle} from "@stamhoofd/utility"
import { computed, getCurrentInstance, onMounted, reactive, Ref, ref, shallowRef, watch } from 'vue';

import VersionFooter from '../dashboard/settings/VersionFooter.vue';

const isNative = ref(AppManager.shared.isNative)
const loadingDefault = ref(true)
const loadingResults = ref(false)
const showDevelopment = ref(false)
const query = ref("");
const defaultOptions: Ref<Option[]> = shallowRef([]);
const results: Ref<Option[]> = shallowRef([]);
const owner = useRequestOwner()
const input = ref<HTMLInputElement | null>(null)
const resultElements = reactive<HTMLElement[]>([])
const visibleOptions = computed(() => query.value.length == 0 ? defaultOptions.value : results.value)
const isPlatform = STAMHOOFD.userMode === 'platform'
const instance = getCurrentInstance();

onMounted(() => {
    console.info('Mounted OrganizationSelectionView', instance)
})

const {getDefaultOptions, selectOption, getOptionForOrganization} = useContextOptions()

getDefaultOptions().then((opts) => {
    defaultOptions.value = opts;
    loadingDefault.value = false
}).catch(console.error);

let lastQuery = '';
let counter = 0;

const help = () => {
    // todo
}

const focusResult = (index: number) => {
    if (index === -1) {
        if (input.value) {
            input.value.focus();
        }
        return
    }
    if (resultElements) {
        if (resultElements[index]) {
            resultElements[index].focus()
        }
    }
}

const setResults = async (cachedCount: number, organizations: Organization[]) => {
    if (cachedCount !== counter) {
        // A new request have started already
        // (race condition if this was scheduled)
        return
    }

    if (organizations.length == 0) {
        results.value = []
        return;
    }

    // Start loading the options
    const options = await Promise.all(organizations.map(async (organization) => {
        const option = await getOptionForOrganization(organization) as Option
        return option
    }))

    if (cachedCount !== counter) {
        // A new request have started already
        return
    }

    results.value = options
}

const updateResults = async () => {
    const q = query.value
    const cachedCount = counter

    if (q.length == 0 || showDevelopment.value) {
        await setResults(cachedCount, [])
        loadingResults.value = false
        return
    }
    loadingResults.value = true

    try {
        const response = await NetworkManager.server.request({
            method: "GET",
            path: "/organizations/search",
            query: {query: q },
            decoder: new ArrayDecoder(Organization as Decoder<Organization>),
            owner
        })

        if (cachedCount !== counter) {
            // A new request have started already
            return
        }
        await setResults(cachedCount, response.data)
    } catch (e) {
        if (cachedCount !== counter) {
            // A new request have started already
            return
        }
        if (!Request.isAbortError(e)) {
            console.error(e)
            Toast.fromError(e).show()
        }
        await setResults(cachedCount, [])
    }

    if (cachedCount !== counter) {
        // A new request have started already
        return
    }
    loadingResults.value = false
}

const throttleUpdateResults = throttle(updateResults, 500);

const startUpdateResults = async () => {
    const value = query.value
    if (value === lastQuery) {
        return
    }
    lastQuery = value
    loadingResults.value = true
    counter += 1;

    Request.cancelAll(owner)

    if (value.length == 0) {
        await setResults(counter, [])
        loadingResults.value = false
        return
    }
    throttleUpdateResults()
}

watch(query, startUpdateResults);

defineRoutes([
    {
        url: 'aansluiten',
        name: 'join',
        component: async () => (await import('../signup/SignupGeneralView.vue')).default as any,
        paramsToProps(_, query) {
            const code = query?.get("code")
            const organization = query?.get("org")

            if (code && organization) {
                return {
                    initialRegisterCode: {
                        code,
                        organization
                    },
                    visitViaUrl: true
                }
            }
            
            return {
                initialRegisterCode: null,
                visitViaUrl: !!query
            }
        },
        present: 'popup'
    }
])

const $navigate = useNavigate()

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.organization-selection-view {
    max-width: 600px;
    margin: 0 auto;
    width: 100%;

    @media (min-height: 800px) {
        padding-top: 40px;
    }

    &.native {
        padding-top: 0;
    }

    .version-box {
        padding: 15px 0;
    }

    > h1 {
        @extend .style-title-huge;
        @extend .style-text-gradient;
        padding-bottom: 10px;
    }

    > p:not([class]) {
        @extend .style-description;
        padding: 10px 0;
    }

    input.search {
        max-width: none;
    }

    > .spinner-container {
        padding: 10px 0;
    }

    > footer {
        padding-top: 15px;
    }

    > .search-result {
        @extend .style-input-shadow;
        background: $color-background;
        border: $border-width solid $color-border;
        padding: 15px 15px;
        padding-right: 0px;
        border-radius: $border-radius;
        margin: 10px 0;
        transition: transform 0.2s, border-color 0.2s, background-color 0.2s;
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        display: block;
        width: 100%;
        text-align: left;
        position: relative;
        display: flex;
        flex-basis: row;
        align-items: center;
        --block-width: 40px;

        > figure {
            flex-shrink: 0;
            padding-right: 15px;
        }

        > div {
            flex-grow: 1;
            position: relative;
            padding-right: 40px;

            > h1 {
                @extend .style-title-list;
            }

            > .floating {
                position: absolute;
                right: 15px;
                top: 50%;
                transform: translate(0, -50%);
                transition: color 0.2s;
            }

            > p {
                @extend .style-description-small;
            }
        }

        @media (hover: hover) {
            &:hover {
                border-color: $color-primary-gray-light;
                background-color: $color-primary-background;

                > .icon.floating {
                    color: $color-primary;
                }
            }
        }

        &:focus {
            // Create a hight contrast selection state, by adding multiple box shadows, to create a white border
            border-color: $color-primary;

            > .icon.floating {
                color: $color-primary;
            }
        }

        &:active {
            transform: scale(0.95, 0.95);
            border-color: $color-primary;

            > .icon.floating {
                color: $color-primary;
            }
        }
    }
}
</style>
