<template>
    <div class="st-menu st-view">
        <STNavigationBar :title="$t(`2a7f1944-1da2-4a55-bb1d-981aeed5d29e`)" />
        <main>
            <h1>{{ $t('e85a86ee-7751-4791-984b-f67dc1106f6b') }}</h1>

            <p v-if="visibleWebshops.length === 0" class="info-box">
                {{ $t('2aaf6529-b504-45f9-848e-8fe2b52738ec') }}
            </p>

            <STList v-if="visibleWebshops.length > 0">
                <STListItem
                    v-for="webshop in visibleWebshops" :key="webshop.id" element-name="button" :selectable="true" :class="{
                        selected: isSelected('webshop-' + webshop.id),
                    }" @click="openWebshop(webshop)"
                >
                    <h2 class="style-title-list">
                        {{ webshop.meta.name }}
                    </h2>
                    <template #right>
                        <span v-if="isWebshopOpen(webshop)" class="icon dot green right-icon small" />
                    </template>
                </STListItem>
            </STList>

            <!-- other -->
            <template
                v-if="
                    enableWebshopModule &&
                        ((fullAccess && hasWebshopArchive) || canCreateWebshops)
                "
            >
                <hr><STList>
                    <!-- archive -->
                    <STListItem v-if="fullAccess && hasWebshopArchive" element-name="button" :selectable="true" :class="{ selected: isSelected(Button.Archive) }" @click="$navigate(Routes.Archive)">
                        <template #left>
                            <span class="icon archive" />
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('c51b35d1-228b-4ce3-8b27-312b5620b662') }}
                        </h2>
                    </STListItem>

                    <STListItem v-if="canCreateWebshops" element-name="button" :selectable="true" @click="addWebshop()">
                        <template #left>
                            <span class="icon add" />
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('e38c0b49-b038-4c9c-9653-fe1e4a078226') }}
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
import { computed, ref } from 'vue';

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
                .default,
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
                .default,
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
                .default,
        paramsToProps: () => {
            selectButton(Button.Archive);
            return {};
        },
    },
]);
</script>
