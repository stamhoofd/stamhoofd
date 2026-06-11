<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, ModalStackComponent, useCurrentComponent } from '@simonbackx/vue-app-navigation';
import { useLoginRoot } from '@stamhoofd/components/auth/useLoginRoot.ts';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import { useAppNavigate } from '@stamhoofd/components/hooks/useAppNavigate';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import type { Organization } from '@stamhoofd/structures';
import { AppRoute } from '@stamhoofd/structures';
import { getSelectorView } from './getSelectorView';

const getLoginRoot = useLoginRoot();
const context = useContext();
const appNavigate = useAppNavigate();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = context.value.organization ? getOrgScopedRoot(context.value.organization) : (STAMHOOFD.userMode === 'platform' ? getUnscopedRootInPlatformMode() : getUnscopedRootInOrganizationMode());
const component = useCurrentComponent();
let checkRoutes = false;
if (component?.checkRoutes) {
    checkRoutes = true;
    root.setCheckRoutes();
}

function getOrgScopedRoot(organization: Organization) {
    return new ComponentWithProperties(AuthenticatedView, {
        noPermissionsRoot: wrapWithModalStack(new ComponentWithProperties(PromiseView, {
            promise: async () => {
                await appNavigate(AppRoute.OrgScopedRegistration, { properties: { organization }, checkRoutes });
                throw new Error('Should have been navigated away');
            },
        })),
        root: wrapWithModalStack(new ComponentWithProperties(PromiseView, {
            promise: async () => {
                await appNavigate(AppRoute.Dashboard, { properties: { organization }, checkRoutes });
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
                if (context.value.auth.userPermissions?.isEmpty !== false && !context.value.auth.hasSomePlatformAccess()) {
                    await appNavigate(AppRoute.UnscopedRegistration, { checkRoutes });
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
