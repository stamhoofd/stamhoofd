# Views and navigation

Stamhoofd uses Vue 3 single-file components and
[`@simonbackx/vue-app-navigation`](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/getting-started.md),
not vue-router. App flows need stacks, reusable views and modal editing in addition
to URLs. Views do not decide their own presentation: the same component can appear
in a popup, in a split pane or as a full screen, with controller-provided back/close
actions. Covered views retain state instead of reconstructing it from a fixed
back-button URL.

Routes add URL restoration for destinations that need direct links. They do not
replace stack navigation. The framework handles responsive controllers, navigation
animations and browser-back integration; do not assume browser-forward navigation
has the same guarantees.

The library provides navigation primitives, not Stamhoofd's navigation bar,
inputs or styles. Those belong to `frontend/shared/components` and
`frontend/shared/scss`.

## First Stamhoofd view

Create `MyView.vue` next to the views for the relevant feature. Use the shared
layout rather than custom margins or padding:

```vue
<template>
    <div class="st-view">
        <STNavigationBar :title="$t('Mijn scherm')" />
        <main>
            <h1>{{ $t('Mijn scherm') }}</h1>
            <p>{{ $t('Hallo wereld') }}</p>
        </main>
    </div>
</template>

<script setup lang="ts">
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
</script>
```

`.st-view` supplies full-view layout, scrolling and spacing. Keep the navigation
bar directly before main. Its title participates in navigation title handling,
and its back/close buttons come from the containing controllers. Add a toolbar
after main only when the existing layout calls for one. SCSS in the component is
optional; reserve it for genuinely component-specific styling.

From an existing view's setup script:

```ts
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import MyView from './MyView.vue';

const show = useShow();
async function openMyView() {
    await show({ components: [new ComponentWithProperties(MyView, {})] });
}
```

Wire `openMyView` to a button such as
`<button class="button text" type="button" @click="openMyView">{{ $t('Openen') }}</button>`.
Call hooks during setup, not after an await inside an event handler. Always await
show, present, navigate, pop and dismiss when sequencing navigation.

## Reading path

1. [Building blocks](building-blocks.md): full-view anatomy, lists, forms and styles.
2. [View helpers](../../frontend/shared/components/src/hooks) and
   [overlays](../../frontend/shared/components/src/overlays): application APIs.
3. [Navigation concepts](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/navigation-concepts.md):
   show/pop versus present/dismiss, with stack diagrams and videos.
4. [Navigation actions](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/navigation-api.md):
   modal wrappers, leave guards and awaited transitions.
5. [Routes](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/routes.md):
   direct URL entry, parameters, props and query preservation.
6. [Controllers](controllers.md): Stamhoofd tabs, loading and authentication containers,
   with links to generic stack/split composition.

## Naming

- Full views end in `View`: `SettingsView.vue`, `EditUserView.vue`.
- Partial-view building blocks end in `Box`: `SomeListBox.vue`, not `SomeListView.vue`.
- Inputs and other ordinary components do not need a `Box` suffix.
- New user-facing text uses Dutch `$t(...)` source strings, not English strings
  or manually generated translation keys.
