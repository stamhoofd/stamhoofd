<template>
    <div data-testid="organization-selection-view">
        <STGradientBackground v-if="$isStamhoofd" />

        <div class="st-view" :class="{ transparent: $isStamhoofd }">
            <STNavigationBar :large="!isNative" class="transparent" :title="$t(`%5N`)">
                <template #left>
                    <PlatformLogo />
                </template>
                <template v-if="!isNative" #right>
                    <a class="button text only-icon-smartphone" :href="'https://'+$domains.marketing+''" rel="noopener">
                        <span class="icon external" />
                        <span>{{ $t('%Xf') }}</span>
                    </a>

                    <a v-if="!isPlatform" class="button primary" href="/aansluiten" data-testid="signup-link" @click.prevent="$navigate(Routes.Join)">
                        {{ $t("%3t") }}
                    </a>
                </template>
            </STNavigationBar>

            <main class="center small organization-selection-view">
                <h1>
                    {{ $t('%5N') }}
                </h1>

                <p class="style-description-block">
                    {{ $t('%6') }}
                </p>

                <form class="input-icon-container icon search small gray" @submit.prevent>
                    <input
                        ref="input" v-model="query" autofocus class="input" :placeholder="$t('%3u')" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" data-testid="organization-search-input"
                        @keydown.down.prevent="focusResult(0)"
                    >
                </form>

                <div v-if="showVersionFooter" class="version-box">
                    <VersionFooter />
                </div>

                <Spinner v-else-if="loadingResults" class="gray center" />
                <template v-else>
                    <button v-for="(option, index) in visibleOptions" :key="option.id" ref="resultElements" v-long-press="(e: any) => showContextMenu(e, option)" type="button" class="search-result" data-testid="organization-button" @keydown.down.prevent="focusResult(index + 1)" @keydown.up.prevent="focusResult(index - 1)" @click="selectOption(option)" @contextmenu.prevent="(e: any) => showContextMenu(e, option)">
                        <ContextLogo :organization="option.organization" :app="option.app" />
                        <div>
                            <h1>{{ getAppTitle(option.app, option.organization, 'other') }}</h1>

                            <p v-if="getAppDescription(option.app, option.organization, 'other')" class="style-description">
                                {{ getAppDescription(option.app, option.organization, 'other') }}
                            </p>
                            <p v-if="option.userDescription" class="style-description-small style-em">
                                {{ $t('%WF') }} {{ option.userDescription }}
                            </p>

                            <span v-if="option.userDescription" class="icon success primary floating" />
                        </div>
                    </button>
                </template>

                <p v-if="!loadingResults && visibleOptions.length === 0 && query" class="info-box">
                    {{ $t('%WG') }}
                </p>

                <footer v-if="!isPlatform">
                    <a v-if="!isNative" href="/aansluiten" class="button text full selected" @click.prevent="$navigate(Routes.Join)">
                        <span class="icon add" />
                        <span>{{ $t('%WH') }}</span>
                    </a>

                    <button class="button text full" type="button" @click="help">
                        <span class="icon help" />
                        <span>{{ $t('%WI') }}</span>
                    </button>
                </footer>

                <PlatformFooter />
            </main>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import Spinner from '@stamhoofd/components/Spinner.vue';
import PlatformFooter from '@stamhoofd/components/auth/PlatformFooter.vue';
import ContextLogo from '@stamhoofd/components/context/ContextLogo.vue';
import PlatformLogo from '@stamhoofd/components/context/PlatformLogo.vue';
import VersionFooter from '@stamhoofd/components/context/VersionFooter.vue';
import { useAppData } from '@stamhoofd/components/context/appContext.ts';
import type { Option } from '@stamhoofd/components/context/hooks/useContextOptions.ts';
import { useContextOptions } from '@stamhoofd/components/context/hooks/useContextOptions.ts';
import STGradientBackground from '@stamhoofd/components/icons/STGradientBackground.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { Organization } from '@stamhoofd/structures';
import { throttle } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';

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
const { getAppTitle, getAppDescription } = useAppData();

const { getAllOptions, getDefaultOptions, selectOption, getOptionForOrganization } = useContextOptions();

defaultOptions.value = getDefaultOptions();
const $navigate = useNavigate();

const showContextMenu = async (event: MouseEvent, option: Option) => {
    const isSearching = query.value.length > 0;

    // Options whose id starts with 'org-' come from SessionManager storage and can
    // be manually added/removed. Permission-derived options (admin, dashboard-*, etc.)
    // are rebuilt automatically and must not offer a "remove from favorites" action.
    const isStoredOrg = option.id.startsWith('org-');

    const menuItems: ContextMenuItem[] = [];

    const addToFavorites = (org: Organization) => new ContextMenuItem({
        name: $t('Voeg toe aan favorieten'),
        icon: 'star',
        action: async () => {
            try {
                await SessionManager.addOrganizationToStorage(org);
                await refreshDefaultOptions();
            } catch (e) {
                Toast.fromError(e).show();
            }
            return true;
        },
    });

    const removeFromFavorites = (org: Organization) => new ContextMenuItem({
        name: $t('Verwijder uit favorieten'),
        icon: 'star',
        action: async () => {
            try {
                await SessionManager.removeOrganizationFromStorage(org.id);
                await refreshDefaultOptions();
            } catch (e) {
                Toast.fromError(e).show();
            }
            return true;
        },
    });

    const logOut = (session: SessionContext) => new ContextMenuItem({
        name: $t('Uitloggen'),
        icon: 'logout',
        action: async () => {
            try {
                await session.logout(false);
                await refreshDefaultOptions();
            } catch (e) {
                Toast.fromError(e).show();
            }
            return true;
        },
    });

    if (!isSearching) {
        // Load the session from local storage only (no network) to check login state.
        const session = new SessionContext(option.organization);
        await session.loadFromStorage();

        if (session.canGetCompleted()) {
            menuItems.push(logOut(session));
        }

        if (isStoredOrg && option.organization) {
            menuItems.push(removeFromFavorites(option.organization));
        }
    } else if (option.organization) {
        const orgId = option.organization.id;
        const storage = await SessionManager.getSessionStorage(true);
        const isInFavoritesList = storage.organizations.some(o => o.id === orgId);

        if (isInFavoritesList) {
            menuItems.push(removeFromFavorites(option.organization));
        } else {
            menuItems.push(addToFavorites(option.organization));
        }
    }

    if (menuItems.length === 0) return;

    void new ContextMenu([menuItems]).show({ clickEvent: event });
};

const refreshDefaultOptions = async () => {
    defaultOptions.value = await getAllOptions();
};

onMounted(async () => {
    await refreshDefaultOptions();
    // Refresh when a session is prepared (e.g. after navigating to an org and back),
    // so newly visited orgs appear in the list without a full page reload.
    SessionManager.addListener(owner, (changed) => {
        if (changed === 'session') {
            refreshDefaultOptions().catch(e => console.error('Failed to load organization options:', e));
        }
    });
});

onUnmounted(() => {
    SessionManager.removeListener(owner);
});

let lastQuery = '';
let counter = 0;

const help = () => {
    if (isNative.value) {
        new CenteredMessage(
            $t('%1AR'),
            $t('%1AS'),
        )
            .addCloseButton()
            .show();
    } else {
        new CenteredMessage(
            $t('%1AR'),
            $t('%1AT'),
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
    } catch (e) {
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
        component: async () => (await import('./SignupGeneralView.vue')).default as any,
        defaultProperties(query) {
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
        propsToParams(props) {
            if (!props.initialRegisterCode || !props.visitViaUrl) {
                return {
                    query: null,
                };
            }

            return {
                query: new URLSearchParams([
                    ['code', props.initialRegisterCode.code],
                    ['org', props.initialRegisterCode.organization],
                ]),
            };
        },
    },
]);
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.organization-selection-view {
     > h1 {
        @media (min-height: 800px) and (min-width: 600px) {
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
        @extend %style-input-shadow;
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
                @extend %style-title-list;
            }

            > .floating {
                position: absolute;
                right: 15px;
                top: 50%;
                transform: translate(0, -50%);
                transition: color 0.2s;
            }

            > p {
                @extend %style-description-small;
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
