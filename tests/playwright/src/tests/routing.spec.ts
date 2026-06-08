// test should always be imported first (sets up the worker services + environment)
import '../test-fixtures/base.js';
import { runRoutingScenario } from '../helpers/routing/RoutingHelpers.js';

// ===========================================================================
// Auto behaviour on the bare host (path = '')
// ===========================================================================

// --- platform mode, singleOrganization = false ---------------------------------------------

runRoutingScenario({
    name: 'navigate to root: unauthenticated in platform mode, shows login',
    userMode: 'platform',
    singleOrganization: false,
    user: 'unauthenticated',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-login'],
});

runRoutingScenario({
    name: 'navigate to root: user with org permissions in platform mode, shows selector',
    userMode: 'platform',
    singleOrganization: false,
    user: 'organization',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-selector'],
});

runRoutingScenario({
    name: 'navigate to root: user with no permissions in platform mode, shows registration',
    userMode: 'platform',
    singleOrganization: false,
    user: 'none',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-registration', 'platform-logo'],
    clickInstructions: [
        { name: 'cart tab', clicks: [{ tab: 'cart' }], expectedPath: '/leden/mandje', expectedElements: ['go-to-checkout-button'] },
    ],
});

runRoutingScenario({
    name: 'navigate to root: user with global permissions in platform mode, shows selector',
    userMode: 'platform',
    singleOrganization: false,
    user: 'global',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-selector'],
});

// --- platform mode, singleOrganization = true ----------------------------------------------

runRoutingScenario({
    name: 'navigate to root: user with global permissions in single org mode, shows dashboard',
    userMode: 'platform',
    singleOrganization: true,
    user: 'global',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-dashboard', 'org-switcher'],
    clickInstructions: [
        { name: 'switch to the member portal (Ledenportaal)', clicks: [{ testId: 'org-switcher' }, { testId: 'app-option-registration' }], expectedElements: ['app-root-registration'] },
    ],
});

// --- organization mode ---------------------------------------------------------------------

runRoutingScenario({
    name: 'navigate to root: unauthenticated user in organization mode, shows selector',
    userMode: 'organization',
    singleOrganization: false,
    user: 'unauthenticated',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-selector'],
});

runRoutingScenario({
    name: 'navigate to root: user with global permissions in organization mode, shows selector',
    userMode: 'organization',
    singleOrganization: false,
    user: 'global',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-selector'],
});

runRoutingScenario({
    name: 'navigate to root: user with organization permissions in organization mode, shows dashboard',
    userMode: 'organization',
    singleOrganization: false,
    user: 'organization',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-dashboard'],
    clickInstructions: [
        { name: 'navigate to root: webshops tab', clicks: [{ tab: 'webshops' }], expectedPath: orgUri => `/beheerders/${orgUri}/verkopen`, expectedElements: ['app-root-dashboard'] },
    ],
});

runRoutingScenario({
    name: 'navigate to root: user with no permissions in organization mode, shows selector',
    userMode: 'organization',
    singleOrganization: false,
    user: 'none',
    host: 'dashboard',
    initialPath: '',
    initialExpectedElements: ['app-root-selector'],
});

// ===========================================================================
// Auto behaviour for the path /auto/@organizationUri
// ===========================================================================

// --- platform mode, singleOrganization = false ---------------------------------------------

runRoutingScenario({
    name: 'navigate to [root]/auto/@orgUri: unauthenticated user in platform mode, shows login',
    userMode: 'platform',
    singleOrganization: false,
    user: 'unauthenticated',
    host: 'dashboard',
    initialPath: orgUri => `/auto/${orgUri}`,
    initialExpectedElements: ['app-root-login'],
});

runRoutingScenario({
    name: 'navigate to [root]/auto/@orgUri: user with global permissions in platform mode, shows dashboard',
    userMode: 'platform',
    singleOrganization: false,
    user: 'global',
    host: 'dashboard',
    initialPath: orgUri => `/auto/${orgUri}`,
    initialExpectedElements: ['app-root-dashboard'],
});

runRoutingScenario({
    name: 'navigate to [root]/auto/@orgUri: user with organization permissions in platform mode, shows dashboard',
    userMode: 'platform',
    singleOrganization: false,
    user: 'organization',
    host: 'dashboard',
    initialPath: orgUri => `/auto/${orgUri}`,
    initialExpectedElements: ['app-root-dashboard'],
});

runRoutingScenario({
    name: 'navigate to [root]/auto/@orgUri: user with no permissions in platform mode, shows registration',
    userMode: 'platform',
    singleOrganization: false,
    user: 'none',
    host: 'dashboard',
    initialPath: orgUri => `/auto/${orgUri}`,
    initialExpectedElements: ['app-root-registration'],
});

// ===========================================================================
// Auto behaviour for org domain (via CNAME record)
// ===========================================================================

// --- organization mode ---------------------------------------------------------------------

runRoutingScenario({
    name: 'navigate to org domain: unauthenticated user, shows login',
    userMode: 'organization',
    singleOrganization: false,
    user: 'unauthenticated',
    host: 'organizationDomain',
    initialPath: '',
    initialExpectedElements: ['app-root-login'],
});

runRoutingScenario({
    name: 'navigate to org domain: user with global permissions, shows dashboard',
    userMode: 'organization',
    singleOrganization: false,
    user: 'global',
    host: 'organizationDomain',
    initialPath: '',
    initialExpectedElements: ['app-root-dashboard'],
});

runRoutingScenario({
    name: 'navigate to org domain: user with organization permissions, shows dashboard',
    userMode: 'organization',
    singleOrganization: false,
    user: 'organization',
    host: 'organizationDomain',
    initialPath: '',
    initialExpectedElements: ['app-root-dashboard'],
});

runRoutingScenario({
    name: 'navigate to org domain: user with no permissions, shows registration',
    userMode: 'organization',
    singleOrganization: false,
    user: 'none',
    host: 'organizationDomain',
    initialPath: '',
    initialExpectedElements: ['app-root-registration'],
});
