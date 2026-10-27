# Views and navigation (Vue App Navigation)

## Our own framework

App navigation can be significantly more complex than website navigation, making direct comparisons impractical. That's why we don’t rely solely on URL-based navigation (like vue-router). Instead, we use a custom navigation framework specifically designed for apps, providing a smoother, more native-like experience. URL-based navigation is a nice-to-have for Stamhoofd and is only supported for the most important routes.

**Why?**

Six years ago we built our own system because there was no system like this available for Vue. `vue-app-navigation`. Since then, it has proven itself reliable and effective: we haven’t switched to anything else and kept expanding and improving the system. This framework has been a key reason we’re able to build fast and efficiently.

**Benefits**
- **Better separation of views:** Views don’t need to worry about how they’re displayed. Their CSS and HTML don’t have to handle presentation details.
    - For example, if you want to add a back button, the view doesn’t need to know where it goes back to—you just call `pop()` or `dismiss()`.<br>*↔ This is better than a back button with a fixed URL.*
- You can reuse the same view in many places, even with different URLs.
- You can navigate deeply, like editing a category inside another category, and so on, without limits.
- **Responsive design made easy:** On desktop, you might want split views or popups, but on mobile, you want everything stacked vertically. Vue-app-navigation handles this automatically, so you don’t have to worry about it.
- URLs are managed automatically.
- Supports browser back and ~~forward~~ buttons smoothly.
- Animations are smooth and feel natural.

---

## Writing your first view

We use single-file-components in Vue. That means that your HTML, TypeScript and SCSS are all in the same file.

> As a best practice, avoid defining custom CSS in your files unless they only affect the component. If you need custom CSS, you are probably doing something wrong. If you use the right building blocks, you’ll never need to have custom margins or paddings except in very specific views (e.g. a seat plan editor).

> In this guide, we’ll explain how the framework works. We’ll also use some specific Stamhoofd concepts—like our custom class names and components. Keep in mind that the core framework (everything you import from vue-app-navigation) is lightweight and doesn’t include many built-in components or views. That’s where Stamhoofd comes in, providing additional building blocks on top of the framework.

**my-view.vue**

```html
<template>
		<!-- Use the .st-view class -->
    <div class="st-view">
    		<!-- 
	    		The navigation bar contains a title that is visible when you scroll
	    		down — and some buttons.
	    	-->
        <STNavigationBar :title="$t(`My view`)" />

				<!-- main contains the scrollable content -->
        <main>
            <h1>
                {{ $t(`My view`) }}
            </h1>

            <p>Hello world</p>
        </main>
        
        <!-- Sometimes you can have a bottom toolbar or buttons here -->
    </div>
</template>

<!-- Optional -->
<script lang="ts" setup>

</script>

<!-- Optional -->
<style lang="scss">
	
</style>
```

You can find more information about Stamhoofd specific components and views in these guides:

[View building blocks (inline components and classes)](https://github.com/stamhoofd/stamhoofd/blob/main/contributing/frontend/building-blocks.md)

[View API’s](https://github.com/stamhoofd/stamhoofd/blob/main/contributing/frontend/view-apis.md)

---

## Navigating between views

You can navigate between views using four methods: show, present, pop, and dismiss. These are available via the `useShow`, `usePresent`  , `usePop` and `useDismiss` hooks.

Understanding the difference can be tricky at first. The differences are described in [Concept of navigation (when to show, present, pop or dismiss)](navigation-concepts.md)

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
				]
		});
}

</script>
```

[Concept of navigation (when to show, present, pop or dismiss)](navigation-concepts.md)

[Navigation API’s](navigation-api.md)

---

## Routes

How does the app know which view should be opened on entering the app at e.g.<br> `/tag/123`?

An extra abstraction layer on top of the navigation ([Concept of navigation (when to show, present, pop or dismiss)](navigation-concepts.md)), are routes.

You define the routes once in your views, and the routing engine will handle everything else:
- it will automatically set the right URL when navigating a route
- it will restore the views when you navigate to a URL directly

[Route API’s](routes.md)

---

## Navigation controllers

Sometimes you need to display views side by side or in a tab bar. This is what view controllers are for.

View controllers are container views that display multiple views at the same time, or keep track of a stack of views and when/how to display these views.

[Navigation controllers](controllers.md)

---

## Do’s and don’ts

#### Suffix the file name of views with `View`

```html
// 🚫 Don't
// Settings.vue
// EditUser.vue
// SomeListView.vue

// ✅ Do
// SettingsView.vue
// EditUserView.vue
// SomeListBox.vue
```

#### Suffix the file name of partial views with `Box`

Only do this for building blocks that contain a partial view. Inputs and other components should not be suffixed with Box.

```html
// 🚫 Don't
// SomeListView.vue

// ✅ Do
// SomeListBox.vue
```

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
