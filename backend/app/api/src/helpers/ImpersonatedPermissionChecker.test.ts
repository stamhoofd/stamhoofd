import { AdminPermissionChecker } from './AdminPermissionChecker.js';
import { DUAL_CHECKED_PERMISSIONS } from './ImpersonatedPermissionChecker.js';

/**
 * Methods that keep the administrator's own answer while impersonating.
 *
 * An impersonated session inherits the administrator's checker, so this is the default:
 * leaving something out of DUAL_CHECKED_PERMISSIONS can never widen what the session
 * reaches. The list below records the ones where that default is also the *right* answer,
 * so the next reader does not have to work it out again.
 */
const ANSWERED_AS_THE_ADMINISTRATOR = [
    // Identity, not permission. The checks that build on them run for both accounts, each
    // with their own identity.
    'isUserManager',
    'checkScope',

    // Decide whether the *frontend* expects an (empty) privateMeta object. An
    // administrator may only impersonate an account whose permissions they hold
    // themselves (coversPermissionsOf), so their expectation covers the impersonated
    // user's. The private data itself is gated by canAccessPrivateOrganizationData.
    'doesFrontendExpectPrivateMeta',
    'hasSomeUnloadedAccess',
    'hasSomeUnloadedPlatformAccess',

    // Decide who may be impersonated, which is a question about the administrator alone.
    // An impersonated session may not start another one (see ImpersonationService).
    'canImpersonate',
    'coversPermissionsOf',

    // Only strips fields of a new member, and takes the role of the caller as an argument
    // instead of reading it from the checker.
    'filterMemberPut',

    // Walks the answers of a member and hands each record to canAccessRecordCategory,
    // which is dual checked.
    'loopRecordAnswerSettingsAccess',

    // Answer with something other than a yes or no, and are combined explicitly in
    // ImpersonatedPermissionChecker.
    'canFilterMembersOnRecordId',
    'checkEventAccess',
    'filterMemberData',
    'filterMemberPatch',
    'getOrganizationTagsWithAccessRight',
    'getPlatformAccessibleOrganizationTags',
    'temporarilyGrantMemberAccess',

    // Lookups, caches and error builders.
    'cacheGroup',
    'cacheGroups',
    'constructor',
    'error',
    'getGroup',
    'getGroups',
    'getOrganization',
    'getOrganizationCurrentPeriod',
    'getOrganizationPermissions',
    'getSingleRecord',
    'getUnloadedOrganizationPermissions',
    'getUnloadedPlatformPermissions',
    'getWebshop',
    'memberNotFoundOrNoAccess',
    'notFoundOrNoAccess',
];

describe('ImpersonatedPermissionChecker', () => {
    test('every method of AdminPermissionChecker is classified', () => {
        const methods = Object.getOwnPropertyNames(AdminPermissionChecker.prototype).filter((name) => {
            // Getters would run their logic on the prototype, and they are not checks.
            const descriptor = Object.getOwnPropertyDescriptor(AdminPermissionChecker.prototype, name);
            return typeof descriptor?.value === 'function';
        });

        const unclassified = methods.filter(name => !(DUAL_CHECKED_PERMISSIONS as string[]).includes(name) && !ANSWERED_AS_THE_ADMINISTRATOR.includes(name));

        // A new method has to be classified: either it is narrowed to the impersonated
        // user, or it belongs in the list above with the reason why the administrator's
        // own answer is the right one.
        expect(unclassified).toEqual([]);
    });

    test('no method is classified twice', () => {
        const both = (DUAL_CHECKED_PERMISSIONS as string[]).filter(name => ANSWERED_AS_THE_ADMINISTRATOR.includes(name));
        expect(both).toEqual([]);
    });

    test('every listed method exists', () => {
        const missing = [...DUAL_CHECKED_PERMISSIONS as string[], ...ANSWERED_AS_THE_ADMINISTRATOR]
            .filter(name => !(name in AdminPermissionChecker.prototype));
        expect(missing).toEqual([]);
    });
});
