// Temporary typecheck shim for app modules imported from shared frontend code.
// Some shared components dynamically import app entrypoints/views, but resolving
// those imports to the real app sources pulls complete apps into shared package
// typechecks and creates package graph cycles. Move these app-specific imports
// behind a typed contract package, or out of shared components, then delete this.
declare module '@stamhoofd/dashboard' {
    export const getOrganizationSelectionRoot: any;
    export const getScopedAutoRoot: any;
    export const getScopedAutoRootComponent: any;
    export const getScopedDashboardRoot: any;
    export const sessionFromOrganization: any;
    export const wrapContext: any;
}

declare module '@stamhoofd/admin-frontend' {
    export const getScopedAdminRoot: any;
    export const getScopedAdminRootFromUrl: any;
}

declare module '@stamhoofd/registration' {
    export const getRootView: any;
    export const getScopedRegistrationRootFromUrl: any;
}

declare module '@stamhoofd/dashboard/src/views/dashboard/webshop/WebshopOverview.vue' {
    const component: any;
    export default component;
}

declare module '@stamhoofd/dashboard/src/views/dashboard/webshop/edit/EditWebshopGeneralView.vue' {
    const component: any;
    export default component;
}

declare module '@stamhoofd/dashboard/src/views/dashboard/settings/UitpasSettingsView.vue' {
    const component: any;
    export default component;
}

declare module '@stamhoofd/admin-frontend/src/views/organizations/OrganizationView.vue' {
    const component: any;
    export default component;
}
