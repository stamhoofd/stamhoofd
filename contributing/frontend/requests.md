# Frontend requests

Use `@simonbackx/simple-networking` through Stamhoofd's session context. The [library guide](https://github.com/SimonBackx/simple-networking/blob/master/docs/requests.md) explains generic ownership, cancellation and middleware; the policies below are Stamhoofd-specific.

## Choose a server

- [NetworkManager.server](../../frontend/shared/networking/src/NetworkManager.ts): main unauthenticated API, version/locale/platform metadata and network retry/update handling.
- [SessionContext.server](../../frontend/shared/networking/src/SessionContext.ts): unauthenticated API scoped to the context's organization when present.
- `SessionContext.authenticatedServer`: same scope, with bearer authentication. Requires a token and refreshes it before sending; expired-token responses can trigger a refresh and retry. Invalid access/refresh tokens clear the session.

Call `useContext()` and `useRequestOwner()` during setup. The owner cancels pending requests and retries before unmount. Opt into `cancelOnDeactivated` for keep-alive views that should stop loading when inactive.

## Read and mutation workflow

GET requests keep the default retry policy. Show appropriate loading UI: the promise can remain pending while the device is offline. Stamhoofd retries transport errors without a count limit, with an online delay growing **linearly** to ten seconds, or an offline wait for connectivity/ten seconds. A shared toast reports repeated failures. Invalid responses and ordinary API errors are not blindly retried.

Set `shouldRetry: false` for PATCH, PUT and DELETE so transport failures surface immediately. Authentication API-error retries remain allowed by default; disabling all retries also requires `allowErrorRetry: false`.

This setup example uses the actual organization update endpoint:

```ts
import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { Organization } from '@stamhoofd/structures';

const context = useContext();
const owner = useRequestOwner();

async function save(patch: AutoEncoderPatchType<Organization>) {
    try {
        const response = await context.value.authenticatedServer.request<Organization>({
            method: 'PATCH',
            path: '/organization',
            body: patch,
            decoder: Organization as Decoder<Organization>,
            shouldRetry: false,
            owner,
        });
        context.value.updateOrganization(response.data);
        return response.data;
    }
    catch (error) {
        if (!Request.isAbortError(error)) Toast.fromError(error).show();
    }
}
```

For reads, pass `method: 'GET'`, an endpoint-specific `decoder`, and optional `query`; decoded content is in `response.data`. PUT sends a complete encodeable body. DELETE uses the endpoint's resource path and only needs a decoder when it returns data. Successful mutations should update the original object from the response before clearing the [editing patch](patching.md); do not clear edits on failure.

## Error and loading UI

Never show abort errors: the consumer has normally already disappeared. Do show other failures for non-retried mutations. `Request.isNetworkError()` also matches aborts and timeouts, so it is too broad for hiding only cancellation errors. Always provide an owner or background retries can outlive the view.

The network middleware handles unsupported-client responses through update/reload UI. Do not implement a competing automatic retry/update policy in each view. A loading indicator belongs to the consuming view; the shared network toast is not a substitute for it.
