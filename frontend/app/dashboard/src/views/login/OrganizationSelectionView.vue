<template>
    <div>
        <STGradientBackground v-if="$isStamhoofd" />

        <div class="st-view" :class="{ transparent: $isStamhoofd }">
            <STNavigationBar :large="!isNative" class="transparent" :title="$t(`5eb72046-9ec6-4072-89ff-5c123636afbe`)">
                <template #left>
                    <PlatformLogo />
                </template>
                <template v-if="!isNative" #right>
                    <a class="button text only-icon-smartphone" :href="'https://'+$domains.marketing+''" rel="noopener">
                        <span class="icon external" />
                        <span>{{ $t('6de2861f-64bc-44fe-af80-5742c91d03d6') }}</span>
                    </a>

                    <a v-if="!isPlatform" class="button primary" href="/aansluiten" data-testid="signup-link" @click.prevent="$navigate(Routes.Join)">
                        {{ $t("2cd40bd9-b158-42e3-81e2-c02c560ab2e5") }}
                    </a>
                </template>
            </STNavigationBar>

            <main class="flex center small organization-selection-view">
                <h1>
                    {{ $t('24a048f6-3c97-4c80-87b7-eccc244b5d12') }}
                </h1>

                <p class="style-description-block style-description-large">
                    {{ $t('b4307772-62dd-48a4-bae3-9d46df314727') }}
                </p>

                <form class="input-icon-container icon search gray" @submit.prevent>
                    <input
                        ref="input" v-model="query" autofocus class="input" :placeholder="$t('89b3f7fe-d2b2-4194-a971-886b0665a0df')" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" data-testid="organization-search-input"
                        @keydown.down.prevent="focusResult(0)"
                    >
                </form>

                <div v-if="showVersionFooter" class="version-box">
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
                                {{ $t('2dfdd151-6245-4f46-ba42-695a09b74607') }} {{ option.userDescription }}
                            </p>

                            <span v-if="option.userDescription" class="icon success primary floating" />
                        </div>
                    </button>
                </template>

                <p v-if="!loadingResults && visibleOptions.length === 0 && query" class="info-box">
                    {{ $t('7046d9e3-c3ce-406b-af52-fd2c81220867') }}
                </p>

                <footer v-if="!isPlatform">
                    <a v-if="!isNative" href="/aansluiten" class="button text full selected" @click.prevent="$navigate(Routes.Join)">
                        <span class="icon add" />
                        <span>{{ $t('5b3e65b1-9444-4b65-a032-e184ed7c2471') }}</span>
                    </a>

                    <button class="button text full" type="button" @click="help">
                        <span class="icon help" />
                        <span>{{ $t('2aead74c-c67c-4844-8ba2-f7f930b35b5e') }}</span>
                    </button>
                </footer>

                <PlatformFooter />
            </main>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextLogo, Option, PlatformFooter, PlatformLogo, Spinner, STGradientBackground, Toast, useAppData, useContextOptions, usePlatform, VersionFooter } from '@stamhoofd/components';
import { AppManager, NetworkManager, useRequestOwner } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { throttle } from '@stamhoofd/utility';
import { computed, onMounted, reactive, Ref, ref, shallowRef, watch } from 'vue';

const isNative = ref(AppManager.shared.isNative);
const loadingResults = ref(false);
const query = ref('');
const defaultOptions: Ref<Option[]> = shallowRef([]);
const results: Ref<Option[]> = shallowRef([]);
const owner = useRequestOwner();
const input = ref<HTMLInputElement | null>(null);
const resultElements = reactive<HTMLElement[]>([]);
const visibleOptions = computed(() => query.value.length === 0 ? defaultOptions.value : results.value);
const isPlatform = STAMHOOFD.userMode === 'platform';
const platform = usePlatform();
const { getAppTitle, getAppDescription } = useAppData();

const { getAllOptions, getDefaultOptions, selectOption, getOptionForOrganization } = useContextOptions();

defaultOptions.value = getDefaultOptions();
const $navigate = useNavigate();

onMounted(async () => {
    // Update options when the default options change
    try {
        defaultOptions.value = await getAllOptions();
    }
    catch (e) {
        console.error('Failed to load organization options:', e);
    }
});

let lastQuery = '';
let counter = 0;

const help = () => {
    if (isNative.value) {
        new CenteredMessage(
            $t('4c7b94c4-1f14-4a8f-881a-a643b3591144'),
            $t('77a3f842-960f-43fa-a9f2-fcac7d3ecc88'),
        )
            .addCloseButton()
            .show();
    }
    else {
        new CenteredMessage(
            $t('4c7b94c4-1f14-4a8f-881a-a643b3591144'),
            $t('ab1a1e43-9fbc-4ffa-bb96-e8b1b61f26c5'),
        )
            .addCloseButton()
            .show();
    }
};

const showVersionFooter = computed(() => {
    return query.value.toLocaleLowerCase().trim() === 'stamhoofd dev';
});

const focusResult = (index: number) => {
    if (index === -1) {
        if (input.value) {
            input.value.focus();
        }
        return;
    }
    if (resultElements) {
        if (resultElements[index]) {
            resultElements[index].focus();
        }
    }
};

const setResults = async (cachedCount: number, organizations: Organization[]) => {
    if (cachedCount !== counter) {
        // A new request have started already
        // (race condition if this was scheduled)
        return;
    }

    if (organizations.length === 0) {
        results.value = [];
        return;
    }

    // Start loading the options
    const options = await Promise.all(organizations.map(async (organization) => {
        const option = await getOptionForOrganization(organization) as Option;
        return option;
    }));

    if (cachedCount !== counter) {
        // A new request have started already
        return;
    }

    results.value = options;
};

const updateResults = async () => {
    const q = query.value;
    const cachedCount = counter;

    if (q.length === 0) {
        await setResults(cachedCount, []);
        loadingResults.value = false;
        return;
    }
    loadingResults.value = true;

    try {
        const response = await NetworkManager.server.request({
            method: 'GET',
            path: '/organizations/search',
            query: { query: q },
            decoder: new ArrayDecoder(Organization as Decoder<Organization>),
            owner,
        });

        if (cachedCount !== counter) {
            // A new request have started already
            return;
        }
        await setResults(cachedCount, response.data);
    }
    catch (e) {
        if (cachedCount !== counter) {
            // A new request have started already
            return;
        }
        if (!Request.isAbortError(e)) {
            console.error(e);
            Toast.fromError(e).show();
        }
        await setResults(cachedCount, []);
    }

    if (cachedCount !== counter) {
        // A new request have started already
        return;
    }
    loadingResults.value = false;
};

const throttleUpdateResults = throttle(updateResults, 500);

const startUpdateResults = async () => {
    const value = query.value;
    if (value === lastQuery) {
        return;
    }
    lastQuery = value;
    loadingResults.value = true;
    counter += 1;

    Request.cancelAll(owner);

    if (value.length === 0) {
        await setResults(counter, []);
        loadingResults.value = false;
        return;
    }
    throttleUpdateResults();
};

watch(query, startUpdateResults);

enum Routes {
    Join = 'join',
}

defineRoutes([
    {
        url: 'aansluiten',
        name: Routes.Join,
        component: async () => (await import('../signup/SignupGeneralView.vue')).default as any,
        paramsToProps(_, query) {
            const code = query?.get('code');
            const organization = query?.get('org');

            if (code && organization) {
                return {
                    initialRegisterCode: {
                        code,
                        organization,
                    },
                    visitViaUrl: true,
                };
            }

            return {
                initialRegisterCode: null,
                visitViaUrl: !!query,
            };
        },
        present: 'popup',
    },
]);
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.organization-selection-view {
     > h1 {
        @media (min-height: 800px) {
            padding-top: 40px;
        }

        &.native {
            padding-top: 0;
        }
     }

    .version-box {
        padding: 15px 0;
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

    form {
        margin-bottom: 10px;
    }

    > .search-result {
        @extend .style-input-shadow;
        background: $color-background;
        border: $border-width solid $color-border;
        padding: 15px 15px;
        padding-right: 0px;
        border-radius: $border-radius;
        margin: 5px 0;
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
