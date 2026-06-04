<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, ModalStackComponent } from '@simonbackx/vue-app-navigation';
import { AuthenticatedView, getLoginRoot, PromiseView, useAppNavigate, useContext } from '@stamhoofd/components';
import type { Organization } from '@stamhoofd/structures';
import { AppRoute } from '@stamhoofd/structures';
import { getSelectorView } from './getSelectorView';

const context = useContext();
const appNavigate = useAppNavigate();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = context.value.organization ? getOrgScopedRoot(context.value.organization) : STAMHOOFD.userMode === 'platform' ? getUnscopedRootInPlatformMode() : getUnscopedRootInOrganizationMode();
root.setCheckRoutes(); // DISCLAIMER waiting for upstream fix

function getOrgScopedRoot(organization: Organization) {
    return new ComponentWithProperties(AuthenticatedView, {
        noPermissionsRoot: wrapWithModalStack(new ComponentWithProperties(PromiseView, {
            promise: async () => {
                await appNavigate(AppRoute.OrgScopedRegistration, { properties: { organization } });
                throw new Error('Should have been navigated away');
            },
        })),
        root: wrapWithModalStack(new ComponentWithProperties(PromiseView, {
            promise: async () => {
                await appNavigate(AppRoute.Dashboard, { properties: { organization } });
                throw new Error('Should have been navigated away');
            },
        })),
        loginRoot: wrapWithModalStack(getLoginRoot()),
    });
}

function getUnscopedRootInPlatformMode() {
    return new ComponentWithProperties(AuthenticatedView, {
        root: wrapWithModalStack(new ComponentWithProperties(PromiseView, {
            promise: async () => {
                if (context.value.auth.userPermissions?.isEmpty && !context.value.auth.hasSomePlatformAccess()) {
                    await appNavigate(AppRoute.UnscopedRegistration);
                    throw new Error('Should have been navigated away');
                } else {
                    return getSelectorView();
                }
            },
        })),
        loginRoot: wrapWithModalStack(getLoginRoot()),
    });
}

function getUnscopedRootInOrganizationMode() {
    return new ComponentWithProperties(AuthenticatedView, {
        root: wrapWithModalStack(new ComponentWithProperties(PromiseView, {
            promise: async () => {
                if (context.value.auth.hasSomePlatformAccess()) {
                    return getSelectorView();
                } else {
                    const org = context.value.organization;
                    if (!org) {
                        throw new Error('User is logged in, thus should have an organization in organization mode');
                    }
                    return getOrgScopedRoot(org);
                }
            },
        })),
        loginRoot: wrapWithModalStack(new ComponentWithProperties(PromiseView, {
            promise: async () => {
                return getSelectorView();
            },
        })),
    });
}
</script>
