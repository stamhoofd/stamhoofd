import { GlobalEventBus } from '#EventBus.ts';
import { useGlobalEventListener } from '#hooks/useGlobalEventListener.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { LoadedPermissions, Permissions, User } from '@stamhoofd/structures';
import { ApiUser, MemberAdmin, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, onActivated, shallowRef } from 'vue';
import { useLoadAdmins } from './useLoadAdmins';

const permissionContextCache = shallowRef(new WeakMap<User, ContextPermissions>());
const apiContextCache = shallowRef(new WeakMap<ApiUser, {
    permissions: LoadedPermissions | null;
    unloadedPermissions: Permissions | null;
}>());

export function usePermissionsCache() {
    const organization = useOrganization();
    const platform = usePlatform();
    const owner = useRequestOwner();

    const getPermissionContext = (user: User | ApiUser) => {
        if (user instanceof ApiUser) {
            const cache = apiContextCache.value;

            const cacheEntry = cache.get(user);
            if (!cacheEntry) {
                const c = {
                    permissions: organization.value ? (user.permissions?.forOrganization(organization.value, null) ?? null) : (user.permissions?.forPlatform(platform.value) ?? null),
                    unloadedPermissions: organization.value ? (user.permissions?.organizationPermissions.get(organization.value.id) ?? null) : (user.permissions?.globalPermissions ?? null),
                };
                cache.set(user, c);
                return c;
            }
            return cacheEntry;
        }
        const cache = permissionContextCache.value;
        if (!cache.has(user)) {
            cache.set(user, new ContextPermissions(UserWithMembers.create(user), organization, platform.value, { allowInheritingPermissions: false }));
        }
        return cache.get(user)!;
    };

    function clearPermissionCache() {
        permissionContextCache.value = new WeakMap<User, ContextPermissions>();
    }

    const getPermissions = (user: User | ApiUser) => {
        return getPermissionContext(user).permissions;
    };

    const getUnloadedPermissions = (user: User | ApiUser) => {
        return getPermissionContext(user).unloadedPermissions;
    };

    GlobalEventBus.addListener(owner, 'organization-updated', async () => {
        clearPermissionCache();
    });

    GlobalEventBus.addListener(owner, 'platform-updated', async () => {
        clearPermissionCache();
    });

    GlobalEventBus.addListener(owner, 'user-updated', async () => {
        clearPermissionCache();
    });

    const hasFullAccess = (user: User) => getPermissions(user)?.hasFullAccess() ?? false;
    const hasEmptyAccess = (user: User) => getPermissions(user)?.isEmpty ?? true;
    const memberHasFullAccess = (member: MemberAdmin) => !!member.users.find(u => hasFullAccess(u));
    const memberHasNoRoles = (member: MemberAdmin) => member.users.every(u => hasEmptyAccess(u));

    onActivated(async () => {
        // Reload admins
        clearPermissionCache();
    });

    return { getPermissions, getUnloadedPermissions, clearPermissionCache, hasFullAccess, hasEmptyAccess, memberHasFullAccess, memberHasNoRoles };
}

/**
 * Will load admins automatically. Use useLoadAdmins if you want to load them manually or need more control over the loading state.
 */
export function useAdmins(options?: {forceLoadOnMount?: boolean}) {
    const organization = useOrganization();
    const { admins, hasAdmins, loading, load, loadPromise } = useLoadAdmins();
    let lastLoaded = new Date();
    const { getPermissions, getUnloadedPermissions, memberHasFullAccess, memberHasNoRoles, clearPermissionCache } = usePermissionsCache();

    if (!hasAdmins.value || options?.forceLoadOnMount) {
        void load(true);
    }

    onActivated(async () => {
        if (lastLoaded < new Date(Date.now() - 1000 * 60 * 5)) {
            lastLoaded = new Date();
            await load(true);
        }
    });

    useGlobalEventListener('members-responsibilities-changed', async () => {
        lastLoaded = new Date();
        void load(true);
    });

    const getPermissionsPatch = (user: User | ApiUser, patch: AutoEncoderPatchType<Permissions> | null): AutoEncoderPatchType<UserPermissions> | UserPermissions => {
        if (organization.value) {
            if (!user.permissions) {
                const base = UserPermissions.create({});
                const p = base.convertPatch(patch, organization.value.id);
                return base.patch(p);
            }
            return user.permissions!.convertPatch(patch, organization.value.id);
        }
        return user.permissions!.convertPlatformPatch(patch);
    };

    function isExternalUser(a: User) {
        if (!organization.value) {
            return !a.permissions?.globalPermissions?.responsibilities.length;
        }
        return !a.permissions?.organizationPermissions.get(organization.value.id)?.responsibilities.length;
    }

    const sortedAdmins = computed(() => {
        return admins.value
            .filter(isExternalUser)
            .sort((a, b) => Sorter.stack(
                Sorter.byBooleanValue(getPermissions(a)?.hasFullAccess() ?? false, getPermissions(b)?.hasFullAccess() ?? false),
                Sorter.byStringValue(a.firstName + ' ' + a.lastName, b.firstName + ' ' + b.lastName),
            ));
    });

    const sortedMembers = computed(() => {
        const members = new Map<string, MemberAdmin>();
        for (const admin of admins.value) {
            if (!admin.memberId) {
                continue; // Skip admins that are not members
            }

            if (!members.has(admin.memberId)) {
                members.set(admin.memberId, new MemberAdmin({ users: [] }));
            }

            const memberAdmins = members.get(admin.memberId)!;
            memberAdmins.users.push(admin);
        }

        return [...members.values()].sort((a, b) => Sorter.stack(
            Sorter.byBooleanValue(memberHasFullAccess(a), memberHasFullAccess(b)),
            Sorter.byStringValue(a.name, b.name),
        ));
    });

    // Sorted members todo

    const pushInMemory = (user: UserWithMembers) => {
        return admins.value.push(user);
    };

    const dropFromMemory = (user: UserWithMembers) => {
        const index = admins.value.findIndex(u => u.id === user.id);

        if (index !== undefined && index !== -1) {
            admins.value.splice(index, 1);
        }
    };

    return { 
        memberHasFullAccess, 
        loading, 
        admins, 
        loadPromise, 
        sortedAdmins, 
        sortedMembers, 
        getPermissionsPatch, 
        pushInMemory, 
        dropFromMemory,
        getPermissions,
        getUnloadedPermissions,
        memberHasNoRoles,
        clearPermissionCache
    };
}
