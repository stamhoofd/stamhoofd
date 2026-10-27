# Sending (authenticated) requests in the frontend

When interacting with the network in our frontend, we use the `@simonbackx/simple-networking` library. This library handles a couple of things for us, such as providing middleware support (which enabled retry behaviour when there are network issues, auto renewing access tokens…). It also provides support for canceling requests and associating owners with requests.

## Servers

A server is a combination of middlewares and the API host you want to call:

```typescript
const server = new Server('https://' + STAMHOOFD.domains.api);
server.middlewares.push(this);
```

#### NetworkManager.server

In Stamhoofd `NetworkManager` provides the main server to communicate with the API. It also self assigns it as a middleware. This middleware is implemented in methods such as `shouldRetryNetworkError` and definces how we handle errors, timeouts, retries, in the frontend.

**Key features**

- When there are network issues, your requests will be automatically retried using exponential backoff.
- It handles deprecated clients: if the server reports to that the client version is not supported any longer, the `NetworkManager` will present an update dialog.

#### SessionContext.server / SessionContext.authenticatedServer

Some classes expand on this, such as the SessionContext. The sessionContext provides two servers: one with authentication and one without. The authenticated server will auto inject the `Authorization` header in every HTTP request (which contains the current access_token) - so the server knows the currently signed in user.

**Key features**

- Automatically refreshing the access token, invisibly. If you fire an authenticated request, it will first renew the access token if it is expired. If the server throws an error that the access token is expired, it will also refresh the token and automatically retry the request without the caller knowing.
- Logging you out if the access token is invalid or the refresh token is expired

You can access the current context from anywhere in Vue using the useContext hook:

```html
<script lang="ts" setup>
    const context = useContext();
    const owner = useRequestOwner();

    async function doRequest(patch: AutoEncoderPatchType<Organization>) {
        await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organizations',
            body: patch,
            shouldRetry: false,
            owner,
        });
    }
</script>
```

---

## Usage

**GET requests**

```typescript
try {
    const response = await context.value.authenticatedServer.request({
        method: 'GET',
        path: '/members',
        owner,

        // Optionally decode the response data
        decoder: new ArrayDecoder(Member as Decoder<Member>),

        // Optionally pass query params (you can use encodeble data too)
        query: {
            search: 'Pablo',
        },
    });
    // ... do something with response
} catch (e) {
    if (!Request.isAbortError(e)) {
        // Only show a toast if it wasn't aborted
        Toast.fromError(e).show();
    }
}
```

**PATCH requests**

Please also read [Patching data](https://github.com/SimonBackx/simple-encoding/blob/master/docs/patching.md)

```typescript
const member = Member.create({/* ... */}); // e.g. loaded from the API earlier

// Your patch that you made in the UI
let patch = Member.patch({ id: 123, name: 'Changed name' });

try {
    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/members',
        owner,

        // Don not retry the request
        shouldRetry: false,

        // Encodeable data will be encoded automatically for you
        body: patch,

        // Optionally decode the response data
        decoder: Member as Decoder<Member>,

        // Optionally pass query params:
        // query: {
        //		search: "Pablo"
        // }
    });

    // ℹ️ response.data is of type Member

    // Copy over the response to our existing object
    member.deepSet(response.data);

    // Clear our patch
    patch = Member.patch({});
} catch (e) {
    if (!Request.isAbortError(e)) {
        // Only show a toast if it wasn't aborted
        Toast.fromError(e).show();
    }
}
```

**PUT requests**

```typescript
try {
    const response = await context.value.authenticatedServer.request({
        method: 'PUT',
        path: '/members',
        owner,

        // Don't retry the request
        shouldRetry: false,

        // Encodeable data will be encoded automatically for you
        body: member,

        // Optionally decode the response data
        decoder: Member as Decoder<Member>,

        // Optionally pass query params:
        // Optionally pass query params:
        // query: {
        //		search: "Pablo"
        // }
    });
    // ... do something with response
} catch (e) {
    if (!Request.isAbortError(e)) {
        // Only show a toast if it wasn't aborted
        Toast.fromError(e).show();
    }
}
```

**Delete requests**

```typescript
try {
    await context.value.authenticatedServer.request({
        method: 'DELETE',
        path: `/members/${id}`,
        owner,

        // Don't retry the request
        shouldRetry: false,

        // Optionally pass body data
        // body: member,

        // Optionally decode the response data
        // decoder: Member as Decoder<Member>,

        // Optionally pass query params:
        // Optionally pass query params:
        // query: {
        //		search: "Pablo"
        // }
    });
    Toast.success('This member has been deleted').show();
    await dismiss({ force: true });
} catch (e) {
    if (!Request.isAbortError(e)) {
        // Only show a toast if it wasn't aborted
        Toast.fromError(e).show();
    }
}
```

---

## Options

#### Request shouldRetry

By default, we’ll keep retrying a request if it fails with a network error or timeout. E.g. if your device is offline, Stamhoofd will keep retrying your request. That means that your .request call will only resolve after the request succeeded or threw a different kind of error.

This is the default behaviour, which is good. You’ll need to make sure you show appropriate loading views while loading async data. This allows the device to restore the internat connection, after which everything will nicely load and the data will appear. When a couple of retries fail, Stamhoofd will display a little toast to inform the user of network issues, so you don’t have to do this yourself.

> This retry behaviour never stops. But we’ll slowly increase the time between the retries to not overload the server.

> This allows us to reboot the server or temorarily take the server offline without anyone noticing.

Only set this to false when you are patching, deleting or updating data. In that case, it is friendlier to just inform the user that there was an issue with the internet connection right away.

#### Aborting requests (request `owner`)

When you create a request, you should always pass in an owner. This can be any object. In Vue you should use the `useRequestOwner` hook.

This owner allows you to cancel all requests that were created with a given owner:

```typescript
Request.cancelAll(owner);
```

When you use `useRequestOwner` you don’t have to call this manually, it will automatically cancel all requests when your component unmounts. It also cancels retries. Let’s say you have network issues, and switch between tabs, then it won’t make sense to keep loading a table in your initial tab. This hook takes care of that for you.

When a request is aborted, all the pending request calls will throw an abort error. You should catch these and never report an error in your UI - as your UI will probably already have disappeared.

```typescript
try {
    const response = await context.value.authenticatedServer.request({
        method: 'GET',
        path: '/members',
        owner,
        decoder: new ArrayDecoder(Member as Decoder<Member>),
    });
    // ... do something with response
} catch (e) {
    // ✅  Since shouldRetry is true, this will never be a network or timeout error
    if (!Request.isAbortError(e)) {
        // Only show a toast if it wasn't aborted
        Toast.fromError(e).show();
    }

    // ✅ This is also fine (because we are retrying the request)
    if (!Request.isNetworkError(e)) {
        // Only show a toast if it wasn't aborted
        Toast.fromError(e).show();
    }
}
```

#### Catching network errors and aborts

`Request.isNetworkError(e)` will return true when it is either a timeout, abort or network issue.

When not retrying requests, you will want to show network errors to the user:

```typescript
try {
    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/members',
        body: patch,
        owner,
        shouldRetry: false,
    });
    // ... do something with response
} catch (e) {
    if (!Request.isAbortError(e)) {
        // Only show network errors
        Toast.fromError(e).show();
    } else {
        // Request was aborted, don't need to do anything
    }
}
```

When you are retrying requests

---

## Do’s and don’ts

#### Don’t show abort errors to the user

```typescript
// 🚫 Do not show abort errors

try {
    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/members',
        body: patch,
        owner,
        shouldRetry: false,
    });
    // ... do something with response
} catch (e) {
    Toast.fromError(e).show();
}

// ✅ Do: hide abort errors

try {
    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/members',
        body: patch,
        owner,
        shouldRetry: false,
    });
    // ... do something with response
} catch (e) {
    if (!Request.isAbortError(e)) {
        // Only show network errors
        Toast.fromError(e).show();
    } else {
        // Request was aborted, don't need to do anything
    }
}
```

#### Do show network errors to the user for not retried requests

```typescript
// 🚫 Don't hide network errors

try {
    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/members',
        body: patch,
        owner,
        shouldRetry: false,
    });
    // ... do something with response
} catch (e) {
    if (!Request.isNetworkError(e)) {
        Toast.fromError(e).show();
    }
    // ‼️ Network errors are not shown to the user
}

// ✅ Do: only hide abort errors

try {
    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/members',
        body: patch,
        owner,
        shouldRetry: false,
    });
    // ... do something with response
} catch (e) {
    if (!Request.isAbortError(e)) {
        // Only show network errors
        Toast.fromError(e).show();
    } else {
        // Request was aborted, don't need to do anything
    }
}
```

#### Do use a request owner

When not passing a request owner, you risk that your request keeps on retrying, even when the user left the view that needed the data.

```typescript
// 🚫 Don't forget passsing a request owner

const response = await context.value.authenticatedServer.request({
		method: 'GET',
    path: '/members'
    decoder: ...
});

// ✅ Do: use a request owner

const owner = useRequestOwner();

...

const response = await context.value.authenticatedServer.request({
		method: 'GET',
    path: '/members'
    decoder: ...,
    owner
});
```

#### Always auto retry GET requests

```typescript
// 🚫 Do not set shouldRetry to false for GET requests

const response = await context.value.authenticatedServer.request({
		method: 'GET',
    path: '/members'
    decoder: ...,
    owner,
    shouldRetry: false
});

// ✅ Do: keep the default

const response = await context.value.authenticatedServer.request({
		method: 'GET',
    path: '/members'
    decoder: ...,
    owner
});
```

#### Disable auto retries for PATCH, PUT, DELETE

```typescript
// 🚫 Do not keep the default for patch, put or delete requests

const response = await context.value.authenticatedServer.request({
		method: 'PATCH',
    path: '/members'
    decoder: ...,
    owner
});

// ✅ Do: set shouldRetry to false for patch, delete or put

const response = await context.value.authenticatedServer.request({
		method: 'PATCH',
    path: '/members'
    decoder: ...,
    owner,
    shouldRetry: false
});
```
