# Stamhoofd frontend

## Development

Inside a services directory, run `yarn serve` to start a development server with hot reloading. Use `yarn build` to compile to the `dist/` folder.

### Development environment

Recommended development environment is VS Code. It should automatically ask you to install the recommended extensions. These are defined in `.vscode/extensions.json`. You'll get a popup from VS Code to install these.

### Linting and formatting

Please install the ESLint and Vetur extension. Prettier is optional, but recommended (disabled for Javascript, TypeScript and Vue files). ESLint is used as a formatter for JavaScript, TypeScript and Vue files. Prettier and ESLint do not work well together, so make sure you disable Prettier for these file types (these settings are already configured in the VSCode workspace settings).

If you do not install the ESLint extension, you won't see linting errors during development. This will make it harder and annoying to develop changes because you'll get lots of warnings and errors when you try to run the code.

### Configuration with Vue CLI

Configuration and development dependencies are managed by Vue CLI. Please refer to the [Configuration Reference](https://cli.vuejs.org/config/#global-cli-config). This makes the setup a bit easier, and we can always decide to move away from Vue CLI in the future.

### Single file components

Single file components are used. These group the HTML, TypeScript/JavaScript and SCSS related to the same Vue component in a single file. [Check the official documentation](https://vuejs.org/v2/guide/single-file-components.html).

-   `src/shared/components/**/*.vue`: Components used by multiple services
-   `src/{service-name}/components/**/*.vue`: Components used by a single service
-   `src/{service-name}/App.vue`: Root vue component that is mounted to the #app element by main.ts

### Styling with SCSS

You can add styles on multiple places, but be careful where:

-   `scss/`
    -   Variables
    -   Styling used in multiple components
    -   Reused styles that have dedicated components
-   `src/shared/components/`
    -   Styles of a shared component, not used outside the component
-   `src/{service-name}/components/`
    -   Styles of a local component, not used outside the component
    -   Global styles specific to the service
    -   Local margins and paddings (try to keep too specific margin and paddings out of shared styles)
-   `src/{service-name}/App.vue`
    -   Inserting the used styles from the shared scss folders
    -   Global styles specific to the service

[SASS modules (@use)](https://sass-lang.com/documentation/at-rules/use) are used over imports, since imports will get removed from SASS in the future.

Inside vue.config.js, we specified to always include `@use "~scss/base/variables.scss" as *;` in webpack SCSS assets (in components). This makes it easier to use variables (to be discussed).

If you make changes inside `shared/scss/`, it's possible that the hot reloading won't work properly because the watcher is only watching the service directory. We'll need to fix this in the future.

The PostCSS [autoprefixer plugin](https://github.com/postcss/autoprefixer) is enabled by default via Vue CLI. [More information about CSS configuration in Vue CLI](https://cli.vuejs.org/guide/css.html).

### TypeScript

[TypeScript](https://www.typescriptlang.org/) is used over JavaScript.

### Designs

Designs are made in Figma and some in Sketch (still need to pick a final one). You can request access via [@SimonBackx](https://github.com/SimonBackx).

## Structure

```bash
# Styling and variables that is used by multiple services
scss/
    base/
        # Adds extra fonts
        fonts.scss
        # Reset all browser specific styles that we don't want to use
        reset.scss
        # Styling for text (use with @extend .style-name)
        text-styles.scss
        # Color and other variable definitions
        variables.scss
    # Style one or multiple elements that are reused often (buttons, inputs)
    components/
    # Styling single elements
    elements/
    # Define the layout of elements without defining the style of the elements
    layout/

 # Fonts, images, icons used by multiple services
assets/
src/
    # One folder per (micro)frontend.
    {service-name}/
        # Compiled result of yarn build is stored in this folder
        dist/
        # Modules
        node_modules/
        # These files will be public, but other public files are added by webpack
        # Normally, you will not have to add files here
        public/
            # Index file, modified by webpack during compilation to include the compiled sources in /src
            index.html
        src/
            # Images, fonts, and other assets only used by this service.
            assets/
            # Contains all the service specific vue components, optionally grouped in folders
            components/
            # Root vue component that is mounted to the #app element by main.ts
            App.vue
            # The root file that mounts the App component to the DOM
            main.ts
            # Add syntax support in your IDE to write JSX-style typescript code (not used)
            shims-tsx.d.ts
            # Makes sure your IDE understands .vue files
            shims-vue.d.ts
        # Defines the browsers we support, e.g. used for css prefixes
        .browserlistrc
        # ESLint config
        .eslintrc.js
        # Dependency manager config (yarn is used)
        package.json
        # Vue cli configuration file (best to adjust webpack config here)
        vue.config.js
        # Versions of each dependency that was installed by yarn
        yarn.lock

    # All shared scripts and assets
    shared/
        # Vue components used by multiple services, optionally grouped in folders
        components/
        classes/

    tsconfig.json
```
