<template>
  <div class="st-menu st-view">
    <STNavigationBar title="Verkoop"></STNavigationBar>
    <main>
      <h1>Webshops</h1>

      <!-- add first webshop -->
      <button
        v-if="
          enableWebshopModule &&
          canCreateWebshops &&
          visibleWebshops.length === 0
        "
        type="button"
        class="menu-button button cta"
        @click="addWebshop()"
      >
        <span class="icon add"></span>
        <span>Maak nieuwe webshop</span>
      </button>

      <!-- webshops -->
      <template v-if="enableWebshopModule && visibleWebshops.length > 0">
        <button
          v-for="webshop in visibleWebshops"
          :key="webshop.id"
          type="button"
          class="menu-button button sub-button"
          :class="{
            selected: isSelected('webshop-' + webshop.id),
          }"
          @click="openWebshop(webshop)"
        >
          <span class="icon"></span>
          <span>{{ webshop.meta.name }}</span>
          <span
            v-if="isWebshopOpen(webshop)"
            class="icon dot green right-icon small"
          ></span>
        </button>

        <button
          v-if="canCreateWebshops"
          type="button"
          class="menu-button button sub-button cta"
          @click="addWebshop()"
        >
          <span class="icon"></span>
          <span class="icon add-line small correct-offset"></span>
          <span>Webshop</span>
        </button>
      </template>

      <!-- archive -->
      <template v-if="enableWebshopModule && fullAccess && hasWebshopArchive">
        <hr />
        <button
          type="button"
          class="menu-button button"
          :class="{ selected: isSelected(Button.Archive) }"
          @click="$navigate(Routes.Archive)"
        >
          <span class="icon archive"></span>
          <span>Archief</span>
        </button>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  defineRoutes,
  useNavigate,
  useUrl,
} from "@simonbackx/vue-app-navigation";
import { useContext, useOrganization } from "@stamhoofd/components";
import {
  AccessRight,
  WebshopPreview,
  WebshopStatus,
} from "@stamhoofd/structures";
import { Formatter, Sorter } from "@stamhoofd/utility";
import { ComponentOptions, computed, onActivated, ref } from "vue";

/**
 * todo:
 * - should be checked if $organization.value is null? Or use '$organization.value!'?
 */

//#region composables
const $organization = useOrganization();
const $context = useContext();
const $navigate = useNavigate();
const urlHelpers = useUrl();
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
  () => $organization.value?.meta.modules.useWebshops ?? false
);

const fullAccess = computed(
  () => $context.value?.organizationAuth.hasFullAccess() ?? false
);

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

//#region lifecycle
onActivated(() => {
  // todo: translate
  urlHelpers.setTitle("Verkoop");
});
//#endregion

//#region functions
function hasAccessRight(right: AccessRight) {
  return $context.value.organizationPermissions?.hasAccessRight(right) ?? false;
}

function selectButton(button: Button | string) {
  currentlySelected.value = button;
}

function isSelected(button: Button | string) {
  return currentlySelected.value === button;
}

async function addWebshop() {
  $navigate(Routes.AddWebshop);
}

async function openWebshop(webshop: WebshopPreview) {
  $navigate(Routes.Webshop, { properties: { preview: webshop } });
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