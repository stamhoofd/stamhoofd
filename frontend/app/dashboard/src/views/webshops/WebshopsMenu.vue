<template>
    <div class="st-menu st-view">
        <STNavigationBar :title="$t(`%2V`)" />
        <main>
            <h1>{{ $t('%HI') }}</h1>

            <p v-if="visibleWebshops.length === 0" class="info-box">
                {{ $t('%Wv') }}
            </p>

            <button
                v-for="webshop in visibleWebshops" :key="webshop.id" class="menu-button button" data-testid="webshop-menu-item" :data-webshop-id="webshop.id" :class="{
                    selected: isSelected(webshop),
                }" type="button" @click="openWebshop(webshop)"
            >
                <span>{{ webshop.meta.name }}</span>
                <span v-if="isWebshopOpen(webshop)" class="icon dot green right-icon small" />
            </button>

            <template
                v-if="
                    enableWebshopModule &&
                        ((fullAccess && hasWebshopArchive) || canCreateWebshops)
                "
            >
                <template v-if="fullAccess && hasWebshopArchive">
                    <hr>
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Archive) }" @click="$navigate(Routes.Archive)">
                        <span class="icon archive" />
                        <span>{{ $t('%1IZ') }}</span>
                    </button>
                </template>

                <template v-if="canCreateWebshops">
                    <hr>
                    <button class="menu-button button" type="button" @click="addWebshop()">
                        <span class="icon add" />
                        <span>{{ $t('%2N') }}</span>
                    </button>
                </template>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import type {
    PrivateWebshop,
    WebshopPreview} from '@stamhoofd/structures';
import {
    AccessRight,
    WebshopStatus,
} from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';

const $organization = useOrganization();
const $navigate = useNavigate();
const auth = useAuth();
const checkRoute = useCheckRoute();

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

async function addWebshop() {
    await $navigate(Routes.AddWebshop);
}

function isSelected(webshop: WebshopPreview) {
    return checkRoute(Routes.Webshop, {
        properties: { preview: webshop },
    });
}

async function openWebshop(webshop: WebshopPreview) {
    await $navigate(Routes.Webshop, { properties: { preview: webshop } });
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

            return {
                preview: webshop,
            };
        },
        propsToParams(props) {
            const webshop = props.preview as WebshopPreview | undefined;

            if (!webshop) {
                throw new Error('Missing preview (webshop)');
            }

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
            return {
                savedHandler: async (webshop: PrivateWebshop) => {
                    await $navigate(Routes.Webshop, {
                        properties: {
                            preview: webshop,
                        },
                    });
                },
            };
        },
    },
    {
        url: 'archief',
        name: Routes.Archive,
        show: 'detail',
        component: async () =>
            (await import('../dashboard/webshop/WebshopArchiveView.vue'))
                .default,
    },
]);
</script>
