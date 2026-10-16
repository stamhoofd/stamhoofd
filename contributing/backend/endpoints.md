# Writing endpoints

Stamhoofd uses `@simonbackx/simple-endpoints`, not Express. Endpoint classes live
in `backend/app/<app>/src/endpoints`; the main API is in
[`backend/app/api/src/endpoints`](../../backend/app/api/src/endpoints).
See the library's [endpoint lifecycle and example](https://github.com/SimonBackx/simple-endpoints/blob/master/docs/endpoints.md)
for matching methods/paths, decoders and responses. That guide is part of this
documentation migration and must be published before the link is available remotely.

## Inputs and responses

`Endpoint<Params, Query, Body, ResponseBody>` separates URL parameters, query
parameters and body data. Match the method in `doesMatch`, then call
`Endpoint.parseParameters(request.url, '/resource/@id', { id: String })`.
Only String and integer Number parameters are supported. Use
`Record<string, never>` when there are no URL parameters.

Set `queryDecoder` or `bodyDecoder` when the corresponding input exists, and use
`undefined` for absent inputs. The decoded handler receives typed
`request.params`, `request.query` and `request.body`. Shared API structures live
in `@stamhoofd/structures`; do not return database models as API structures.
Convert models with the appropriate structure builder, then return `new Response(...)`.
Responses also support structure arrays, strings, bytes, streams and `undefined`;
set a non-JSON content type for raw output.

The current [GetUserEndpoint](../../backend/app/api/src/endpoints/auth/GetUserEndpoint.ts)
shows matching, organization scope, authentication and structure conversion.
Its `/user` route returns the current account; do not copy the old `/user/@id`
example as a current route or assume its access rules apply elsewhere.

## Authentication and authorization

Requests run inside [Context](../../backend/app/api/src/helpers/Context.ts).
Establish the relevant organization scope before authenticating.
`await Context.authenticate()` requires a valid authenticated user and returns
the user and token. Authentication options relax specific constraints: copy them
only when the endpoint actually needs that behavior.

`await Context.optionalAuthenticate()` returns `{ user }` when authenticated and
may return `{}` when authentication is absent. It does not suppress every error;
for example, an inactive organization can still cause an authentication error.
After authentication, helpers can read `Context.user` without passing it through
every call.

Authentication is not authorization. Use `Context.auth` and the checks in
[AdminPermissionChecker](../../backend/app/api/src/helpers/AdminPermissionChecker.ts)
to verify access to each resource. Accessing the permission checker before
authentication throws. Reject unauthorized requests rather than relying on UI gating.

## Errors and translations

Throw `SimpleError` or `SimpleErrors` from `@simonbackx/simple-errors` for errors
the client should receive. Unexpected errors are treated as internal server errors.

```ts
throw new SimpleError({
    code: 'invalid_name',
    message: 'Name is required',
    human: $t('Vul een naam in'),
    field: 'name',
    statusCode: 400,
});
```

`message` is English developer text; `human` uses Dutch `$t(...)` source text.
`field` and `statusCode` are optional. Context configures request-local translation
preferences; see its i18n setup rather than implementing header parsing in endpoints.
Release tooling replaces Dutch source strings with translation keys: do not edit
`shared/locales/src/nl.json` manually.

## Tests

Endpoint changes need unit and integration coverage. Follow neighboring endpoint
tests, using `TestUtils.setEnvironment(...)` for environment-specific behavior.
Run `pnpm stam test api` (or its filename filter) from the repository root; it
owns shared builds and the isolated database. Never provision test databases manually.
