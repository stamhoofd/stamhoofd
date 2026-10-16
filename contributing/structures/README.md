# Encoding and decoding structures

[shared/structures](../../shared/structures) contains the versioned data structures shared by Stamhoofd's backend and frontend. They define API bodies, JSON stored by models, and locally persisted client data. Keeping the representation shared allows both sides to validate and interpret the same data.

An encoded structure is plain data suitable for JSON serialization; decoding validates that data and restores a class instance with its methods. `JSON.parse` alone does neither. Most of this behavior comes from `@simonbackx/simple-encoding`, with Stamhoofd-specific decoders and domain logic in the structures package.

## Reading order

1. [Writing AutoEncoder classes](https://github.com/SimonBackx/simple-encoding/blob/master/docs/autoencoder.md): fields, defaults, nullable values, and a complete encode/decode example.
2. [Patching data](https://github.com/SimonBackx/simple-encoding/blob/master/docs/patching.md) and [patching arrays](https://github.com/SimonBackx/simple-encoding/blob/master/docs/patching-arrays.md): record changes separately, compose them, and apply them without changing the original.
3. [Versioning data](https://github.com/SimonBackx/simple-encoding/blob/master/docs/versioning.md), followed by [Stamhoofd's release policy](versioning.md): preserve compatibility with old clients and persisted data. Read both before modifying a structure.
4. [Manual encoding in Stamhoofd](manual-encoding.md): exceptional representations and protocol/security contracts that need custom implementations.

The detailed generic API contracts live in the [library source](https://github.com/SimonBackx/simple-encoding/tree/master/src). New shared structures normally extend AutoEncoder rather than manually implementing its interfaces.

## Using structures at application boundaries

Prefer the existing helpers instead of manually encoding/decoding at every call site:

- **Frontend requests:** the [request guide](../frontend/requests.md) covers servers that send encodable request bodies and decode responses with the supplied decoder. [NetworkManager](../../frontend/shared/networking/src/NetworkManager.ts) owns the application's networking middleware.
- **Local persistence:** the [storage guide](../frontend/local-storage.md) covers browser/app storage. Store versioned JSON explicitly; do not assume a later app version can decode data without its original encoding version.
- **Database persistence:** the [database guide](../backend/database.md) covers structures in JSON columns through `@simonbackx/simple-database`. Stamhoofd's [QueryableModel](../../backend/shared/sql/src/QueryableModel.ts) supplies its additional query-building API.
- **Backend endpoints:** the [endpoint guide](../backend/endpoints.md) covers typed input decoders and structure responses. Do not replace this with unvalidated JSON or Express-style handlers.

Keep the encoding version and medium appropriate to the boundary. For persisted envelopes, `VersionBoxDecoder` returns a wrapper whose restored value is `.data`; it does not return the structure directly.
