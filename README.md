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
