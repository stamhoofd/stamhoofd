<p align="center">
<img src="https://www.stamhoofd.be/images/logo.svg" alt="Stamhoofd" height="50"><br><br>
Open-source software for clubs and organizations
</p>

# Folder structure

We recently moved to a monorepo to make it easier for new contributors to make changes without having to work in different repositories and creating multiple pull requests. Now you can bundle all your changes in one pull request.

## Frontend 

For everything frontend related, you can take a look at the readme in the frontend folder. We have two SPA, written with Vue + TypeScript. The frontend is build on a custom (open-source) framework 'vue-app-navigation' that makes handing responsive and app-like views/navigation/animations easy. You'll see that it is easy to learn and understand.

## Backend

Documentation and code is located in the backend folder.

## Shared

We have some packages that are shared between the frontend and backend. The most important one is `structures`. This package contains all the data structures (communication in the API, stored in the backend, in an encrytped blob or in localstorage) and how they should be encoded and decoded. The data structures are versioned: when an old client communicates with an updated backend, everything will work as usual. Make sure you keep everything backwards compatible, read the documantation in [@simonbackx/simple-encoding](https://github.com/simonbackx/simple-encoding). If you need to add some new data, you'll probably need to make some changes in this package.

# Contributing

Do you want to contribute? GREAT! :D You can build features that you need for your own club or you can help the project. 

This is what you need to know:

1. Try to keep all communication in English, even when you know everyone is speaking the same language. It makes it easier for others to find answers to some questions later on and to join a conversation. We know the software is currently in Dutch only, but that will change in the future ;) 
2. We recommend you to create an issue before starting to build something (unless it is a bugfix or a small improvement, then you can open up a PR right away). Big features should be discussed first.
3. Look at the issues if you want to help build something, or open an issue if you want to help but don't know where to start
4. Before we can merge a pull request, you'll need to sign a contributor license agreement (CLA in short, we use the Apache template). This is to both protect your work and the project (to make sure all the work of the community doesn't get endangered by an individual). We'll send you the contributor license agreement when you need it (todo: upload the CLA to the website).

## Development

To run everything locally, we need to glue all the packages together and build them. We only publish packages to the NPM registry during a release.

1. We use `yarn`. Do not use `npm`. That will break things.
2. When switching branches or when pulling changes, run `yarn install` first.
3. Use `yalc` (≠ yarn) to glue local packages together during development. We'll provide some instructions and scripts for this later on.
