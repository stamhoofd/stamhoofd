# Route API’s

How does the app know to what view it needs to go when you enter the app at e.g.<br> `/tag/123`?

An extra abstraction layer on top of the navigation ([Concept of navigation (when to show, present, pop or dismiss)](navigation-concepts.md)), are routes.

You define the routes once in your views, and the routing engine will handle everything else:

- it will automatically set the right URL when navigating a route
- it will restore the views when you navigate to a URL directly

---

## Structure

Routes look like this:

```typescript
defineRoute({
    url: '/tags',
    component: TagsView, // Can also be an async method
    present: 'popup', // Presented as a popup, can also be 'sheet' or 'true' (full cover)
});
```

```typescript
defineRoute({
    name: 'Tags',
    url: '/tags',
    component: TagsView, // Can also be an async method
    show: true, // normal show, can also be 'detail'
});
```

You need to give every route a url, component and display style. Optionally you can give a route a name. You can reference a route by both the name and url.

You can define the routes of your view via [defineRoutes (legacy)](#defineroutes-legacy)

### Properties and parameters

A route can also have properties and parameters:

- _**Parameters**_ are the parts of your URL that contain an id or something identifyable that lets you restore the state later on. You can define them using the `props` property of you route and use the `@` prefix in your URL.
- _**Properties**_ are the actual `props` the view component will receive when mounted.

You’ll need to implement `paramsToProps` and `propsToParams` to convert between the two. If not provided, the paramters will be passed on to the view as-is.

```typescript
defineRoute({
    url: 'tag/@slug',
    name: Routes.Tag,
    show: 'detail',
    component: OrganizationTagView,
    params: {
        slug: String,
    },
    paramsToProps(params: { slug: string }) {
        const tag = platform.value.config.tags.find((t) => Formatter.slug(t.name) === params.slug);
        return {
            tag,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug(props.tag.name),
            },
        };
    },
});
```

_`paramsToProps` can be an async method, so you can do an API call if needed._

If you don’t have parameters inside your URL, paramsToProps won’t be available and you’ll need to use `defaultProperties` if you still want properties passed to the component, or want to read from the URL querystring:

```javascript
defineRoute({
    url: 'tag/all',
    name: Routes.AllTags,
    show: 'detail',
    component: OrganizationTagView,
    defaultProperties(_query) {
        return {
            tag: 'all',
        };
    },
});
```

### Async components

A best practice to improve code chunking, is to not import components at the top of your files, but directly at component. The routing library will take care of showing a loading view while the chunk is loading.

```javascript
defineRoute({
    url: 'categorie/@slug',
    name: Routes.Category,
    params: {
        slug: String,
    },
    show: 'detail',
    component: async () => ((await import('../dashboard/groups/CategoryView.vue')).default),
    paramsToProps: (params) => {
        const category = tree.value.getAllCategories().find(g => Formatter.slug(g.settings.name) === params.slug);
        if (!category) {
            throw new Error('Category not found');
        }
        return {
            category,
            period: period.value,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug((props.category as GroupCategory).settings.name),
            },
        };
    },
});
```

### Query strings

Some routes might need to read from the url querystring. The routing library automatically listens what querystrings you read in paramsToProps, so those query strings will be kept in the URL.

```javascript
defineRoute({
    name: AppRoute.VerifyEmail,
    url: 'verify-email/@organizationUri',
    params: {
        organizationUri: String,
    },
    component: ExampleComponent,
    paramsToProps: async (params, query) => {
        const org = await uriToOrganization(params.organizationUri);
        if (!org) {
            Toast.error(
                $t('Kan je e-mailadres niet verifiëren: deze vereniging bestaat niet (meer)', {
                    uri: params.organizationUri,
                }),
            ).show();
            throw new Error('No organization found for the given URI, but required for this route');
        }
        if (!query?.get('token') || !query?.get('email')) {
            Toast.error($t('Kan je e-mailadres niet verifiëren: ongeldige link')).show();
            throw new Error('Token or email missing in query parameters for verify-email route');
        }
        return {
            organization: org,
            token: query?.get('token') ?? '',
            email: query?.get('email') ?? '',
            code: query?.get('code') ?? undefined,
        };
    },
    propsToParams: (props) => ({
        params: {
            organizationUri: props.organization.uri,
        },
        query: props.code
            ? new URLSearchParams([
                  ['token', props.token],
                  ['email', props.email],
                  ['code', props.code],
              ])
            : new URLSearchParams([
                  ['token', props.token],
                  ['email', props.email],
              ]),
    }),
});
```

<br>When directly navigating to a route:

```javascript
const navigate = useNavigate();
// ...
navigate(Route.VerifyEmail, {
    properties: {
        organization: myOrganization,
        token: 'xxxxx',
        email: 'test@stamhoofd.be',
        code: '1234',
    },
});
```

The routing library will use propsToParams to determine how properties should be converted to the URL parameter organizationUri, and what query strings to keep in the URL.

If you have a route without url parameters, you can still use query inside defaultProperties.

```javascript
defineRoute({
    name: AppRoute.VerifyEmail,
    url: $t('verify-email'),
    component: ExampleComponent,
    defaultProperties: (query) => ({
        token: query?.get('token') ?? '',
        email: query?.get('email') ?? '',
        code: query?.get('code') ?? undefined,
    }),
    propsToParams: (props) => ({
        query: props.code
            ? new URLSearchParams([
                  ['token', props.token],
                  ['email', props.email],
                  ['code', props.code],
              ])
            : new URLSearchParams([
                  ['token', props.token],
                  ['email', props.email],
              ]),
    }),
});
```

---

## API’s

### defineRoute

This is the preferred API because TypeScript has difficulties with defineRoutes (it doesn’t support an array with generic types that are totally different for every array item).

```html
<template> ... </template>

<script lang="ts" setup>
    enum Routes {
        All = 'all',
        Tag = 'tag',
        Personalization = 'personalization'
    }

    defineRoute{
        url: 'tag/@slug',
        name: Routes.Tag,
        show: 'detail',
        component: OrganizationTagView,
        params: {
            slug: String,
        },
        paramsToProps(params: { slug: string }) {
            const tag = platform.value.config.tags.find(t => Formatter.slug(t.name) === params.slug);
            if (!tag) {
                throw new Error('Tag not found');
            }

            return {
                tag,
            };
        },
        propsToParams(props) {
            if (!('tag' in props) || !(props.tag instanceof OrganizationTag)) {
                throw new Error('Missing tag');
            }

            return {
                params: {
                    slug: Formatter.slug(props.tag.name),
                },
            };
        },
    });
</script>
```

### defineRoutes (legacy)

To define the routes a view can navigate to in each view component, use the defineRoutes hook in your view. It is a best practive to use an _enum_ to name all your routes, so they are easier to reference.

```html
<template> ... </template>

<script lang="ts" setup>
    enum Routes {
        All = 'all',
        Tag = 'tag',
        Personalization = 'personalization',
    }

    defineRoutes([
        {
            url: 'allemaal',
            name: Routes.All,
            show: 'detail',
            component: OrganizationsTableView,
            isDefault: {
                properties: {},
            },
        },
        {
            url: 'tag/@slug',
            name: Routes.Tag,
            show: 'detail',
            component: OrganizationTagView,
            params: {
                slug: String,
            },
            paramsToProps(params: { slug: string }) {
                const tag = platform.value.config.tags.find(
                    (t) => Formatter.slug(t.name) === params.slug,
                );
                if (!tag) {
                    throw new Error('Tag not found');
                }

                return {
                    tag,
                };
            },
            propsToParams(props) {
                if (!('tag' in props) || !(props.tag instanceof OrganizationTag)) {
                    throw new Error('Missing tag');
                }

                return {
                    params: {
                        slug: Formatter.slug(props.tag.name),
                    },
                };
            },
        },
        // Presenting as a popup:
        {
            url: Routes.Personalization,
            component: PersonalizeSettingsView,
            present: 'popup',
        },
    ]);
</script>
```

**Some real examples**

- SettingsView: `frontend/app/dashboard/src/views/dashboard/settings/SettingsView.vue`
- ModernTableView (uses async props): `frontend/shared/components/src/tables/ModernTableView.vue`

### useNavigate: Navigating to a route

To navigate to a route, you can use `useNavigate`:

```typescript
const navigate = useNavigate();
```

```html
<template>
    ...
    <button type="button" @click="navigate(Routes.All)">All members</button>
    ...
</template>

<script lang="ts" setup>
    enum Routes {
        All = 'all',
        ...
    }
    defineRoutes(...);

    const navigate = useNavigate();
</script>
```

For routes that have properties, you can either pass the properties or the attributes of a route (they will get converted automatically).

```typescript
await navigate(Routes.Tag, { properties: { tag } });
await navigate(Routes.Tag, { params: { slug: 'tag-slug' } });

// Disable animation:
await navigate(Routes.Tag, { properties: { tag }, animated: false });
```

### useCheckRoute: currently selected route

To know if a current route is used (e.g. in the split view controller’s left side view), you can use checkRoute:

```typescript
const checkRoute = useCheckRoute();
```

```html
<button type="button" :class="{ selected: checkRoute(Routes.All) }" @click="navigate(Routes.All)">
    All members
</button>
```
