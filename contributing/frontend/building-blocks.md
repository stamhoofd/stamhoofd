# View building blocks

Prefer existing components and classes over custom margins, padding or CSS.
Look at nearby views first. Component-specific styling is appropriate for unusual
interfaces, but should not duplicate the shared layout system.

## View anatomy

Use `.st-view` on the full-view root and put `STNavigationBar` directly before
the scrollable `<main>`. Add `center` to main for wide layouts; without it content
uses the available width. Centering also constrains separators.

```vue
<template>
    <div class="st-view">
        <STNavigationBar :title="$t('Instellingen')" />
        <main class="center">
            <h1>{{ $t('Instellingen') }}</h1>
        </main>
    </div>
</template>

<script setup lang="ts">
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
</script>
```

![Centered settings content](../assets/building-blocks/centered-content.png)

Contracts: [view styles](../../frontend/shared/scss/layout/st-view.scss) and
[text styles](../../frontend/shared/scss/base/text-styles.scss). Direct main
children such as headings and separators get standard spacing. Use `.container`
when grouping content more deeply but retaining those text-container styles.

## Navigation bar and saving

[STNavigationBar](../../frontend/shared/components/src/navigation/STNavigationBar.vue)
adds back/close buttons from the enclosing controllers. Set `:disable-pop="true"`
or `:disable-dismiss="true"` to suppress them. Put additional buttons in `#right`
with the `navigation` class:

```vue
<STNavigationBar :title="$t('Instellingen')">
    <template #right>
        <button class="button navigation highlight" type="button" @click="save">
            {{ $t('Opslaan') }}
        </button>
    </template>
</STNavigationBar>
```

`save` is the view's handler; the bar does not save data itself.
For editable forms, prefer [SaveView](../../frontend/shared/components/src/navigation/SaveView.vue),
which places save/delete controls according to platform conventions (for example,
save at the top on iOS and at the bottom on desktop).
See [SaveViewProps](../../frontend/shared/components/src/navigation/SaveViewProps.ts)
and [EditGroupView](../../frontend/shared/components/src/groups/EditGroupView.vue)
for an application example, rather than duplicating the form layout manually.

## Lists

[STList](../../frontend/shared/components/src/layout/STList.vue) and
[STListItem](../../frontend/shared/components/src/layout/STListItem.vue) render
consistent list spacing and separators:

```vue
<STList>
    <STListItem>
        <h3 class="style-title-list">{{ $t('Titel') }}</h3>
        <p class="style-description-small">{{ $t('Beschrijving') }}</p>
    </STListItem>
</STList>
```

Import these components from `@stamhoofd/components/layout/STList.vue` and
`@stamhoofd/components/layout/STListItem.vue` in your setup script.

- `selectable` gives a row action styling and changes its default element to a
  button when not disabled. `element-name` chooses an explicit element.
- `disabled` applies disabled styling; it is not a backend permission check.
- `right-stack` places right-slot children side by side.
- `no-padding` removes content-slot padding; use it only when necessary.

Use `#left` for an [IconContainer](../../frontend/shared/components/src/icons/IconContainer.vue)
on secondary actions that do not fit in the navigation bar. Its `#aside` slot
can show a small status/action badge. Use `#right` for an arrow or trailing action:

```vue
<STListItem :selectable="true" @click="openItem">
    <template #left>
        <IconContainer icon="box">
            <template #aside><span class="icon add small primary" /></template>
        </IconContainer>
    </template>
    <h3 class="style-title-list">{{ $t('Item') }}</h3>
    <template #right><span class="icon arrow-right-small gray" /></template>
</STListItem>
```

Illustrations are reserved for settings overviews: use `.illustration-list` on
STList, `.left-center` on the item, and an image in `#left`, for example
`@stamhoofd/assets/images/illustrations/group.svg`.

### Draggable lists

Set `:draggable="true"`, bind the reordered array with `v-model`, and render
the `#item="{ item }"` slot. Add a `.drag` handle, typically in the right slot:

```vue
<STList v-model="items" :draggable="true">
    <template #item="{ item }">
        <STListItem class="right-stack">
            <h3 class="style-title-list">{{ item.name }}</h3>
            <template #right>
                <span class="button icon drag gray" @click.stop @contextmenu.stop />
            </template>
        </STListItem>
    </template>
</STList>
```

`items` is a writable array ref/computed. For patch-backed data, the existing
[useDraggableArray/useDraggableArrayIds](../../frontend/shared/components/src/hooks/useDraggableArray.ts)
helpers translate reordering into patches. Given a patch helper's `patched` and
`addArrayPatch`, the source pattern is
`useDraggableArray(() => patched.value, addArrayPatch)`. Read their declarations
for the supported record/ID types. STList's cross-list update path is not supported.

See [patching inside views](patching.md) for the editing hooks used by patch-backed lists.

## Icons and buttons

Icons inherit the text color and use the generated `.icon` plus icon-name classes,
for example `<span class="icon edit" />`. The base size is 24px; size modifiers
and button styles can reduce it. Sources live in
[assets/images/icons](../../frontend/shared/assets/images/icons).
The shared [Vite configuration](../../frontend/shared/vite-config/vite.config.shared.ts)
generates the font/CSS automatically. After changing icons, restart `pnpm stam dev`
so the app's Vite process regenerates them; there is no separate manual icon command.

Use one primary call-to-action per view. `button secundary` (the existing spelling)
is for secondary actions, and `button text` for smaller inline actions. Set the
appropriate button type. When mixing icons and text, wrap each child in a span:

```vue
<button class="button primary" type="button">
    <span class="icon add" />
    <span>{{ $t('Toevoegen') }}</span>
</button>
```

## Messages and inputs

The [message styles](../../frontend/shared/scss/components/errors.scss) provide
`info-box`, `warning-box` and `error-box`, for example
`<p class="info-box">{{ $t('Extra informatie') }}</p>`.

Select inputs from [components/src/inputs](../../frontend/shared/components/src/inputs).
For example, `PhoneInput` supports `v-model="phone"` and `:validator="validator"`;
import it from `@stamhoofd/components/inputs/PhoneInput.vue` and consult its props
for required/nullable behavior. Input validation is not replaced by a visual box.

The [form validation and errors guide](form-validation.md) remains TODO.
