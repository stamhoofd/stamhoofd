// This shouldn't be used anymore because we have vue-tsc that knows about Vue components
// Otherwise we won't notice missing vue files with this shim.
// The problem is that Eslint and other TypeScript dependent tools don't know about .vue components
// So we need these

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<object, object, any>;
    export default component;
}
