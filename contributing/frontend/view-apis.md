# View APIs

Call lifecycle/injection hooks during component setup, not inside click handlers or asynchronous callbacks. Keep the returned refs/objects for those handlers. The [hooks directory](../../frontend/shared/components/src/hooks) holds the contracts.

## Context and editing hooks

`useOrganization()` returns a computed ref whose **value** can be null. Organization dashboards have a scope; platform/member portals may not. `useRequiredOrganization()` is only a type assertion for views that guarantee that scope: it does not load an organization or throw when missing.

```ts
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization';

const organization = useOrganization();
function clickButton() {
    const name = organization.value?.name;
    if (name) alert(name);
}
```

`useContext()` reads the ancestor-provided SessionContext; `useUser()` returns a computed ref to its user or null. Use the context for [requests](requests.md). [useAuth](../../frontend/shared/components/src/hooks/useAuth.ts) returns a permission checker, not computed refs; wrap checks in `computed` when needed. Frontend checks never replace backend authorization.

For computed input fields and child-to-parent edits, read [patching inside views](patching.md). The [edit-view pattern](../patterns/edit-views.md) remains TODO. See [translations](translations.md) for `$t` and Dutch source strings.

## Formatting

Use [Formatter](../../shared/utility/src/Formatter.ts) in scripts, or the registered template helpers:

```ts
import { Formatter } from '@stamhoofd/utility/Formatter.js';
const formattedPrice = Formatter.price(12_300); // € 1,23
```

```vue
<template>
    <div>{{ formatPrice(12_300) }}</div>
</template>
```

Prices use 1/10,000-euro units, not cents. Only helpers registered in [VueGlobalHelper](../../frontend/shared/components/src/VueGlobalHelper.ts) and declared in [vue.d.ts](../../frontend/vue.d.ts) are template globals; arbitrary Formatter methods still require an import.

## Context menus

![Context menu with a nested submenu](../assets/view-apis/context-menu.png)

Group items with nested arrays; a `childMenu` provides a deeper menu. Anchor a menu to the event or to a button:

```ts
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu';

function makeMenu(doDelete: () => void, doExport: () => void) {
    return new ContextMenu([[
        new ContextMenuItem({ name: $t('Verwijderen'), icon: 'trash', action: doDelete }),
        new ContextMenuItem({
            name: $t('Exporteren…'),
            childMenu: new ContextMenu([[
                new ContextMenuItem({ name: $t('Exporteren naar PDF'), action: doExport }),
                new ContextMenuItem({ name: $t('Exporteren naar Excel'), action: doExport }),
            ]]),
        }),
    ]]);
}

async function showAtEvent(event: MouseEvent, doDelete: () => void, doExport: () => void) {
    await makeMenu(doDelete, doExport).show({ clickEvent: event });
}

async function showAtButton(button: HTMLElement, doDelete: () => void, doExport: () => void) {
    await makeMenu(doDelete, doExport).show({ button, xPlacement: 'right', yPlacement: 'bottom' });
}
```

`show()` resolves with the menu, not an item selection. Returning `true` from an action is unnecessary: current leaf-click handling closes the menu independently and ignores the return value. Handle failures inside asynchronous actions; the view does not await them. See [ContextMenu](../../frontend/shared/components/src/overlays/ContextMenu.ts).

## Confirmations

![Confirmation dialog](../assets/view-apis/confirmation.png)

Use the options overload, not the deprecated positional API:

```ts
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';

const confirmed = await CenteredMessage.confirm({
    title: $t('Ben je zeker?'),
    confirmText: $t('Bevestigen'),
});
```

It resolves true for confirmation and false for cancellation. `CenteredMessage.show()` supports custom button values; see its [contract](../../frontend/shared/components/src/overlays/CenteredMessage.ts).

## Toasts

![Success toast](../assets/view-apis/toast.png)

```ts
import { Toast } from '@stamhoofd/components/overlays/Toast';

Toast.info($t('Ter informatie')).show();
Toast.success($t('De wijzigingen zijn opgeslagen')).show();
Toast.warning($t('Controleer de gegevens')).show();
Toast.error($t('Er ging iets mis')).show();

const toast = Toast.info($t('Bezig met laden')).setHide(null).show();
// Hide when the operation finishes:
toast.hide();
```

Toasts appear near the bottom of the UI and autohide after eight seconds by default. `setHide(null)` leaves them visible until `hide()`. For caught failures use `Toast.fromError(error).show()`, excluding request aborts as explained in [requests](requests.md). `show()` returns the toast, not a promise. See [Toast](../../frontend/shared/components/src/overlays/Toast.ts).

## Tooltips

![Tooltip on an edit button](../assets/view-apis/tooltip.png)

Use the registered directive for a message shown after hovering:

```vue
<button v-tooltip="$t('Gegevens bewerken')">{{ $t('Bewerken') }}</button>
```
