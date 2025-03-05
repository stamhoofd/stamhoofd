<template>
    <div class="st-menu st-view">
        <STNavigationBar :title="$t(`dc27b6b9-e49c-4c8b-b5e4-cb27cb1e2b5d`)"/>
        <main>
            <h1>{{ $t('c280fdd0-fa09-4a5e-a6b1-6bc0aa152e53') }}</h1>

            <p class="info-box" v-if="visibleWebshops.length === 0">
                {{ $t('33590d9d-7d95-47c2-8ddb-90d39c349e97') }}
            </p>

            <STList v-if="visibleWebshops.length > 0">
                <STListItem v-for="webshop in visibleWebshops" :key="webshop.id" element-name="button" :selectable="true" :class="{
                        selected: isSelected('webshop-' + webshop.id),
                    }" @click="openWebshop(webshop)">
                    <h2 class="style-title-list">
                        {{ webshop.meta.name }}
                    </h2>
                    <template #right>
                        <span v-if="isWebshopOpen(webshop)" class="icon dot green right-icon small"/>
                    </template>
                </STListItem>
            </STList>

            
            <template v-if="
                    enableWebshopModule &&
                        ((fullAccess && hasWebshopArchive) || canCreateWebshops)
                ">
                <hr><STList>
                    
                    <STListItem v-if="fullAccess && hasWebshopArchive" element-name="button" :selectable="true" :class="{ selected: isSelected(Button.Archive) }" @click="$navigate(Routes.Archive)">
                        <template #left>
                            <span class="icon archive"/>
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('f8e18afd-9ec9-4695-adc5-d6f2351d8dc3') }}
                        </h2>
                    </STListItem>

                    
                    <STListItem v-if="canCreateWebshops" element-name="button" :selectable="true" @click="addWebshop()">
                        <template #left>
                            <span class="icon add"/>
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('047179b8-f6d9-4517-9f03-ef79e448a23e') }}
                        </h2>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth, useOrganization } from '@stamhoofd/components';
import {
    AccessRight,
    WebshopPreview,
    WebshopStatus,
} from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref } from 'vue';

// #region composables
const $organization = useOrganization();
const $navigate = useNavigate();
const auth = useAuth();
// #endregion

// #region refs
const selectedWebshop = ref<string | null>(null);
const currentlySelected = ref<string | null>(null); // todo: avoid this pattern - there is a built in pattern for this that is much simpler
// #endregion

// #region enums
enum Button {
    AddWebshop = 'add-webshop',
    Archive = 'webshop-archive',
    Signup = 'signup',
}
// #endregion

// #region computed
const enableWebshopModule = computed(
    () => $organization.value?.meta.packages.useWebshops ?? false,
);

const fullAccess = computed(() => auth.permissions?.hasFullAccess() ?? false);

const allWebshops = computed(() => {
    if (!$organization.value) return [];
    return $organization.value.webshops;
});

const visibleWebshops = computed(() =>
    allWebshops.value
        .filter(webshop => webshop.meta.status !== WebshopStatus.Archived)
        .sort((a, b) =>
            Sorter.stack(
                Sorter.byBooleanValue(b.isClosed(), a.isClosed()),
                Sorter.byStringValue(a.meta.name, b.meta.name),
            ),
        ),
);

const canCreateWebshops = computed(() =>
    auth.hasAccessRight(AccessRight.OrganizationCreateWebshops),
);

const hasWebshopArchive = computed(() =>
    allWebshops.value.some(
        webshop => webshop.meta.status === WebshopStatus.Archived,
    ),
);

function selectButton(button: Button | string) {
    currentlySelected.value = button;
}

function isSelected(button: Button | string) {
    return currentlySelected.value === button;
}

async function addWebshop() {
    await $navigate(Routes.AddWebshop);
}

async function openWebshop(webshop: WebshopPreview) {
    await $navigate(Routes.Webshop, { properties: { preview: webshop } });
}

function selectWebshop(webshop: WebshopPreview) {
    const id = webshop.id;
    selectedWebshop.value = id;
    selectButton('webshop-' + id);
}

function isWebshopOpen(webshop: WebshopPreview) {
    return !webshop.isClosed();
}


enum Routes {
    Webshop = 'webshop',
    AddWebshop = 'addWebshop',
    Archive = 'archive',
}

defineRoutes([
    // webshop detail
    {
        url: '@slug',
        name: Routes.Webshop,
        params: {
            slug: String,
        },
        show: 'detail',
        component: async () =>
            (await import('../dashboard/webshop/WebshopOverview.vue'))
                .default as unknown as ComponentOptions,
        paramsToProps: ({ slug }: { slug: string }) => {
            const webshop = visibleWebshops.value.find(
                shop => Formatter.slug(shop.id) === slug,
            );

            if (!webshop) {
                throw new Error('Webshop not found');
            }

            selectWebshop(webshop);

            return {
                preview: webshop,
            };
        },
        propsToParams(props) {
            const webshop = props.preview as WebshopPreview | undefined;

            if (!webshop) {
                throw new Error('Missing preview (webshop)');
            }

            selectWebshop(webshop);

            const slug = Formatter.slug(webshop.id);

            return {
                params: {
                    slug,
                },
            };
        },
        isDefault: {
            properties: {
                preview: visibleWebshops.value[0],
            },
        },
    },
    {
        url: 'nieuw',
        name: Routes.AddWebshop,
        show: 'detail',
        present: 'popup',
        component: async () =>
            (await import('../dashboard/webshop/edit/EditWebshopGeneralView.vue'))
                .default as unknown as ComponentOptions,
        paramsToProps: () => {
            selectButton(Button.AddWebshop);
            return {};
        },
    },
    {
        url: 'archief',
        name: Routes.Archive,
        show: 'detail',
        component: async () =>
            (await import('../dashboard/webshop/WebshopArchiveView.vue'))
                .default as unknown as ComponentOptions,
        paramsToProps: () => {
            selectButton(Button.Archive);
            return {};
        },
    },
]);
</script>
