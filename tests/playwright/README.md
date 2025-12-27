# Stamhoofd Playwright tests

Playwright tests for Stamhoofd.

## Todo
Set a fixed time. The tests should be predictable. Now the current time in tests will change depending on the date the test is run.

## Authentication

The `test-fixtures` folder contains several fixtures:

- `base.ts`: a base fixture without authentication that is extended by the other fixtures
- `platform.ts`: a fixture that authenticates a platform user

By using the platform fixture for example you can automatically authenticate a basic platform user.
In the test file you can edit and save the user, for example if you want to add permissions.
The user for the worker can be acquired by calling `WorkderData.user`.
`WorkerData.configureUser` contains helper methods to configure the user.
The user can be reset by calling `WorkerData.resetUser`, or `WorkderData.resetDatabase` if other data should be reset also.

## Test file naming

Seperate test files for each userMode exist.
Tests for userMode `platform` end with `-platform`, tests for userMode `organization` end with `-organization`.
Each worker authenticates a user. This way every test file can share the same user without having to authenticate again. If tests for different userModes would be mixed the authentication would have to be done again every time the userMode changes.

## Error resolving

Here are some solutions for errors that may appear.

### Database error

Try dropping the database for the worker.
