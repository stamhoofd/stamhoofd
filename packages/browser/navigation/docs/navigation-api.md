# Navigation API’s

> Make sure to read [Concept of navigation (when to show, present, pop or dismiss)](navigation-concepts.md) before continuing here. Otherwise you’ll have issues with understanding the differences.

These API’s don’t support URL based routing. They are sometimes used in Stamhoofd, but often you better use the  [Routes](routes.md) API’s.

### show: Showing a view

```html
<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`Other view`)" />

        <main>
            <h1>
                {{ $t(`Other view`) }}
            </h1>

            <p>Hello world</p>
            
            <button class="button text" type="button" @click="gotoView">
		            Go to other view
            </button>
        </main>
    </div>
</template>

<script lang="ts" setup>
import MyView from "./my-view.vue";
import { useShow } from "@simonbackx/vue-app-navigation";

const show = useShow();

async function gotoView() {
		await show({
				components: [
						new ComponentWithProperties(MyView, {})
				]
		});
}

</script>
```

### **present: Presenting a view**

When presenting view, you need to choose a modalDisplayStyle. This can either be “popup” or “sheet”. A sheet is a smaller version of a popup with a dynamic height (e.g. used in the webshop).

```typescript
const present = usePresent();

async function gotoView() {
		await present({
				components: [
						new ComponentWithProperties(NavigationController, {
							root: new ComponentWithProperties(MyView, {})
						})
				],
				modalDisplayStyle: "popup"
		});
}
```

*In the example above, we wrap MyView with NavigationController (**[NavigationController](controllers.md#navigationcontroller)**) - this wraps MyView in a navigation stack so it can ‘show’ other views. These views will be displayed in the same popup.*

### **dismiss/pop: Going back**

- useDismiss(): to undo a ‘present’
- usePop(): to undo a ‘show’

For example, say you ‘present’ a view A, then show view B. If you pop in view B, you’ll go back to view A. If you dismiss in view B, you’ll dismiss both view A and B at the same time (because they are in the same modal stack).

```html
<template>
		<div>
				<button @click="onBackButtonClicked" type="button">Back</button>
		</div>
</template>

<script lang="ts" setup>
const pop = usePop();

async function onBackButtonClicked() {
		await pop();
}
</script>
```

```typescript
const dismiss = useDismiss();

async function onCloseButtonClicked() {
		await dismiss();
}
```

### **shouldNavigateAway: Prevent going back / leaving view**

You can prevent that a view gets popped or is being dismissed. Just implement the shouldNavigateAway method, [and expose it in your view](https://vuejs.org/api/sfc-script-setup#defineexpose).

If you return true, you’ll allow the view from being unmounted/dismissed/popped.

> This won’t prevent showing or presenting views on top of your current view (you can still return to the view, your changes won’t be lost)

```html
<script lang="ts" setup>

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker?'), $t('Ja, zeker'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
```

When using dismiss or pop, you can set the `force` property to ignore shouldNavigateAway. You can use when you automatically close a view when you clicked the save button and saved all the information in the view.

```typescript
const dismiss = useDismiss();

async function save() {
		// (...) save to the server
		await dismiss({ force: true });
}
```

### **canDismiss / canPop**

By default, the navigationbar will show back and close buttons using these properties. These return true/false depending whether there is a previous view or whether the view was displayed modally.

```html
<template>
		<div>
				<button v-if="canPop" @click="pop" type="button">Terug</button>
				<button v-if="canDismiss" @click="dismiss" type="button">X</button>
		</div>
</template>

<script lang="ts" setup>
const canDismiss = useCanDismiss();
const canPop = useCanPop();

const pop = usePop();
const dismiss = useDismiss();
</script>
```

---

## Advanced

#### Replacing views

When showing it is possible to simply override your current view with a new view. You’ll still get an animation as normal, but as soon as your view is fully covered, it will be unmounted. There will be no back button to your original view.

> Note that when you replace views, the `shouldNavigateAway` method will be called as if you pop or dismiss a component. You can prevent this by setting `force: true`.

```html
<template>
    ...
</template>

<script lang="ts" setup>
import MyView from "./my-view.vue";
import { useShow } from "@simonbackx/vue-app-navigation";

const show = useShow();

async function gotoView() {
		await show({
				components: [
						new ComponentWithProperties(MyView, {})
				],
				replace: 1 // Replace 1 view on the stack
		});
}

</script>
```

*If you want to replace all views in the navigation controller, use a very high number such as 100.*

#### Showing multiple views

You can show multiple views in one go. The animation (in animated) will only show the animation to the last view in your array. But when you go back, you’ll first go to the earlier views in your array.

```html
<template>
    ...
</template>

<script lang="ts" setup>
import MyView from "./my-view.vue";
import { useShow } from "@simonbackx/vue-app-navigation";

const show = useShow();

async function gotoView() {
		await show({
				components: [
						new ComponentWithProperties(CartView, {}),
						new ComponentWithProperties(CustomerView, {})
				]
		});
}

</script>
```

*If you want to replace all views in the navigation controller, use a very high number such as 100.*

#### Disabling animations

By default, Stamhoofd will always use the appropriate animations. In rare situations you can force disable animations.

```html
<template>
    ...
</template>

<script lang="ts" setup>
import MyView from "./my-view.vue";
import { useShow } from "@simonbackx/vue-app-navigation";

const show = useShow();

async function gotoView() {
		await show({
				components: [
						new ComponentWithProperties(MyView, {})
				],
				animated: false
		});
}

</script>
```

---

## Do’s and don’ts

#### Await calls to show, present, navigate, pop and dismiss

These methods are async, and certainly when you chain navigation actions, it is important that you await them.

```typescript
// 🚫 Don't
show({ ... });
present({ ... });
navigate(Route.Test, { ... });
dismiss();
pop();

// ✅ Do
await show({ ... });
await present({ ... });
await navigate(Route.Test, { ... });
await dismiss();
await pop();
```
