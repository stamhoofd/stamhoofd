# Writing endpoints

Endpoints in Stamhoofd are stored in `backend/app/<app name>/src/endpoints`

---

## Inputs

An endpoint has three input options:
- Request body

```typescript
{
		id: 123,
		name: "Pablo"
}
```

- Request query parameters<br>`/members?query=Pablo`
- Request URL parameters <br>`/members/@id`

And responds with an encodable object, a string, a stream or no data at all (undefined).

---

## Usage

#### Requests with query params

- Set the Query type.
- Set a queryDecoder (should implement Decoder)
- You can read the (typed) query data using request.query

> The endpoints do contain some boilerplate code in the `doesMatch` method, in the future we’ll probably want to simplify that.

```typescript
// Params: we don't have them: so set it's type to an empty object
type Params = Record<string, never>;

// Define the type of your query parameters (you can use an Encodeable object)
type Query = LimitedFilteredRequest;

// Define the type of your body
type Body = undefined;

// Define the type of your response
type ResponseBody = Member;

export class GetMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    // When specifying a query, you'll need to set the queryDecoder here:
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
		    const member = Member.create({...});
        return new Response(
            member,
        );
    }
}
```

#### Requests with body

- Set the Body type.
- Set a bodyDecoder
- You can read the (typed) body using request.body

```typescript
// Params: we don't have them: so set it's type to an empty object
type Params = Record<string, never>;

// Define the type of your query parameters (you can use an Encodeable object)
type Query = undefined;

// Define the type of your body
type Body = Member;

// Define the type of your response
type ResponseBody = Member;

export class PutMemberEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    // When specifying a body, you'll need to set the bodyDecoder here:
    bodyDecoder = Member as Decoder<Member>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PUT') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
		    // Use the request body with request.body (of type Member)
		    const member = Member.create({...});
        return new Response(
            member,
        );
    }
}
```

#### Requests with URL params

> Only string and number parameters are supported

- Set the Params type.
- Correctly set the 2nd argument of parseParameters
- You can read the (typed) parameters using request.params

```typescript
type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = UserWithMembers;

export class GetUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        const user = await User.getByID(request.params.id);
        if (!user || !(await Context.auth.canAccessUser(user))) {
            throw Context.auth.error();
        }

        return new Response(
            await AuthenticatedStructures.userWithMembers(user),
        );
    }
}

```

---

## Throwing errors

When something goes wrong, always throw a SimpleError or SimpleErrors. All other errors will be treated as an internal server error and won’t be visible for the client.

```typescript
async handle(request: DecodedRequest<Params, Query, Body>) {
    if (notok) {
		    throw new SimpleError({
				    code: "invalid_thing",
				    message: "Please make it valid",
					  human: $t('Maak het leesbaar'),
					  
					  // Optionally pass a field
					  // field: 'id',
					  
					  // Optionally pass a custom status code
					  // statusCode: 404
		    })
    }
    
    // ...
}
```

---

## Translations

Simply use the `$t` global method. Stamhoofd will automatically read the user’s language from the HTTP headers and return the text in the right language.

[Translations](https://github.com/stamhoofd/stamhoofd/blob/main/contributing/frontend/translations.md)

---

## Authentication

All requests are executed in a context. From anywhere in your code, you can use the Context to get data about the current request, but also the currently authenticated user.

**Required authentication**

```typescript
async handle(request: DecodedRequest<Params, Query, Body>) {
		const {token, user} = await Context.authenticate();

		// Garanteed the user is logged in
    // ...
}
```

**Optional authentication**

Sometimes, you don’t require an user to be logged in. E.g. when you do some custom logic if the user is logged in, but it isn’t a hard requirement.

```typescript
async handle(request: DecodedRequest<Params, Query, Body>) {
		const {user} = await Context.optionalAuthenticate();

		if (user) {
				// The user is valid and logged in
				// Do something
		}
}
```

**Getting the current user**

Anywhere in your code you can get the currently logged in user, without having to pass `user` manually.

```typescript
const user = Context.user;
```

**Permission checking**

All access checking methods are implemented in `backend/app/api/src/helpers/AdminPermissionChecker.ts` - you can access them via Context.auth, which also guarantees the current request is authenticated (otherwise it’ll throw an error).

```typescript
if (await Context.auth.canAccessMember(member)) {
		// Do something
}
```
