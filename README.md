# Stamhoofd Backend

This repository contains the backend code for Stamhoofd.

## Stack

-   TypeScript
-   MySQL 8

## How to run

You can run the backend on your local computer by running `yarn start` after installing dependencies via `yarn install`.

## Development

All endpoints should be covered by tests. You can run tests via `yarn test`. Testing is powered by [Jest](https://jestjs.io) ([ts-jest](https://github.com/kulshekhar/ts-jest) for TypeScript).

Use `yarn watch` to restart the server automatically after code changes.

### Code structure

```bash
src/
    # All code related to a single topic are grouped in folders
    {topic-name}/
        # Endpoint implementations
        endpoints/
        # Model implementations
        models/
        # Struct implementations
        structs/

    # Code related to model and database interfaces
    database/

    # Code related to encoding and decoding structures (interfaces)
    structs/

    # Code related to HTTP routing
    routing/

tsconfig.json
```

### Database structure (WIP)

The data is devided in multiple databases. Each database can run on a different MySQL node, but that is not a requirement.

- One general database
    - Contains the `organizations` table with information of all the organizations

- Multiple Organization shards
    - All information of multiple organizations grouped in a single shard. 
        - Members, parents, encrypted health information, users
    - Resharding might be needed when the size of a shard is too big.
    - We make the assumption that an organization will always fit inside one table, and no sharding will be needed inside an organization. 
    - An organization should be able to have millions of members. Supporting these kind of organizations is not a priority right now, but keep this in mind.

Multiple master and/or slave nodes for the same shard might be needed to support high write and/or read throughput. 

### Domains (WIP)

All the endpoints that belong to a single organization are accessible from a unique domain. This has some security advantages and helps to comply with the OAuth2 specification, since users are saved on a per organization level. This way we can detect the organization by looking at the domain and we do not need to add extra properties in OAuth 2.0 endpoints. 

All endpoints that are general, and are not related to a single organization are hosted on a different domain (note that the server could be shared between multiple endpoints and multiple endpoint types).

For Stamhoofd, these domains are defined:
- api.stamhoofd.be is for general endpoints (e.g. creating an organization). **Note that general endpoints also work on non-general domains.**
- api.organization-name.stamhoofd.be: organization specific endpoints (e.g. login, register, create a member...)
- api.custom-name.organization-domain.be: api.organization-name.stamhoofd.be alias. It increases performance because it prevents CORS requests when the registration page is hosted on the organization's domain.
- organization-name.stamhoofd.be: register page for an organization that doesn't have it's own domain name
- custom-name.organization-domain.be: organization-name.stamhoofd.be alias


Across these domains, endpoints always have unique URIs.