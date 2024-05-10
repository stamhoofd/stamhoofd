<template>
    <div class="st-menu st-view">
        <STNavigationBar title="Verkoop" />
        <main>
            <h1>Webshops</h1>

            <STList class="">
                <!-- webshops -->
                <template v-if="enableWebshopModule && visibleWebshops.length > 0">
                    <STListItem
                        v-for="webshop in visibleWebshops" :key="webshop.id" element-name="button"
                        :selectable="true" :class="{
                            selected: isSelected('webshop-' + webshop.id),
                        }" @click="openWebshop(webshop)"
                    >
                        <h2 class="style-title-list">
                            {{ webshop.meta.name }}
                        </h2>
                        <template #right>
                            <span
                                v-if="isWebshopOpen(webshop)"
                                class="icon dot green right-icon small"
                            />
                        </template>
                    </STListItem>
                </template>
            </STList>

            <!-- other -->
            <template
                v-if="
                    enableWebshopModule &&
                        ((fullAccess && hasWebshopArchive) || canCreateWebshops)
                "
            >
                <hr>
                <STList>
                    <!-- archive -->
                    <STListItem
                        v-if="fullAccess && hasWebshopArchive" element-name="button" :selectable="true"
                        :class="{ selected: isSelected(Button.Archive) }" @click="$navigate(Routes.Archive)"
                    >
                        <template #left>
                            <span class="icon archive" />
                        </template>
                        <h2 class="style-title-list">
                            Archief
                        </h2>
                    </STListItem>

                    <!-- add webshop -->
                    <STListItem v-if="canCreateWebshops" element-name="button" :selectable="true" @click="addWebshop()">
                        <template #left>
                            <span class="icon add" />
                        </template>
                        <h2 class="style-title-list">
                            Webshop
                        </h2>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from "@simonbackx/vue-app-navigation";
import { useAuth, useOrganization } from "@stamhoofd/components";
import {
    AccessRight,
    WebshopPreview,
    WebshopStatus,
} from "@stamhoofd/structures";
import { Formatter, Sorter } from "@stamhoofd/utility";
import { ComponentOptions, computed, ref } from "vue";

//#region composables
const $organization = useOrganization();
const $navigate = useNavigate();
const auth = useAuth();
//#endregion

//#region refs
const selectedWebshop = ref<string | null>(null);
const currentlySelected = ref<string | null>(null);
//#endregion

//#region enums
enum Button {
    AddWebshop = "add-webshop",
    Archive = "webshop-archive",
    Signup = "signup",
}
//#endregion

//#region computed
const enableWebshopModule = computed(
    () => $organization.value?.meta.packages.useWebshops ?? false
);

const fullAccess = computed(() => auth.permissions?.hasFullAccess() ?? false);

const allWebshops = computed(() => {
    if (!$organization.value) return [];
    return $organization.value.webshops;
});

const visibleWebshops = computed(() =>
    allWebshops.value
        .filter((webshop) => webshop.meta.status !== WebshopStatus.Archived)
        .sort((a, b) =>
            Sorter.stack(
                Sorter.byBooleanValue(b.isClosed(), a.isClosed()),
                Sorter.byStringValue(a.meta.name, b.meta.name)
            )
        )
);

const canCreateWebshops = computed(() =>
    hasAccessRight(AccessRight.OrganizationCreateWebshops)
);

const hasWebshopArchive = computed(() =>
    allWebshops.value.some(
        (webshop) => webshop.meta.status == WebshopStatus.Archived
    )
);
//#endregion

//#region functions
function hasAccessRight(right: AccessRight) {
    return auth.permissions?.hasAccessRight(right) ?? false;
}

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
    selectButton("webshop-" + id);
}

function isWebshopOpen(webshop: WebshopPreview) {
    return !webshop.isClosed();
}

//#endregion

//#region routes
enum Routes {
    Webshop = "webshop",
    AddWebshop = "addWebshop",
    Archive = "archive",
}

defineRoutes([
    // webshop detail
    {
        url: "@slug",
        name: Routes.Webshop,
        params: {
            slug: String,
        },
        show: "detail",
        component: async () =>
            (await import("../dashboard/webshop/WebshopOverview.vue"))
                .default as unknown as ComponentOptions,
        paramsToProps: ({ slug }: { slug: string }) => {
            const webshop = visibleWebshops.value.find(
                (shop) => Formatter.slug(shop.id) === slug
            );

            if (!webshop) {
                throw new Error("Webshop not found");
            }

            selectWebshop(webshop);

            return {
                preview: webshop,
            };
        },
        propsToParams(props) {
            const webshop = props.preview as WebshopPreview | undefined;

            if (!webshop) {
                throw new Error("Missing preview (webshop)");
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
    // add webshop
    {
        url: "nieuw",
        name: Routes.AddWebshop,
        show: "detail",
        present: "popup",
        component: async () =>
            (await import("../dashboard/webshop/edit/EditWebshopGeneralView.vue"))
                .default as unknown as ComponentOptions,
        paramsToProps: () => {
            selectButton(Button.AddWebshop);
            return {};
        },
    },
    // archive
    {
        url: "archief",
        name: Routes.Archive,
        show: "detail",
        component: async () =>
            (await import("../dashboard/webshop/WebshopArchiveView.vue"))
                .default as unknown as ComponentOptions,
        paramsToProps: () => {
            selectButton(Button.Archive);
            return {};
        },
    },
]);
//#endregion
</script>
