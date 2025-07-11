import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { GlobalEventBus, useGlobalEventListener, useOrganization, usePlatform } from '@stamhoofd/components';
import { ContextPermissions, useRequestOwner } from '@stamhoofd/networking';
import { ApiUser, LoadedPermissions, MemberAdmin, Permissions, User, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, onActivated, shallowRef } from 'vue';
import { useReloadAdmins } from './useReloadAdmins';

export function useAdmins(load = true) {
    const organization = useOrganization();
    const platform = usePlatform();
    const { reload, reloadPromise } = useReloadAdmins();
    let lastLoaded = new Date();

    const loading = computed(() => {
        if (organization.value) {
            return organization.value?.admins === undefined || organization.value?.admins === null;
        }

        // Platform scope
        return platform.value.admins === undefined || platform.value.admins === null;
    });

    if (loading.value && load) {
        void reload(false);
    }

    onActivated(async () => {
        if (load && lastLoaded < new Date(Date.now() - 1000 * 60 * 5)) {
            lastLoaded = new Date();
            await reload(true);
        }

        // Reload admins
        clearPermissionCache();
    });

    useGlobalEventListener('members-responsibilities-changed', async () => {
        if (load) {
            lastLoaded = new Date();
            void reload(true);
        }
    });

    // Listen for updates that require the permission to get recalculated
    const owner = useRequestOwner();

    GlobalEventBus.addListener(owner, 'organization-updated', async () => {
        clearPermissionCache();
    });

    GlobalEventBus.addListener(owner, 'platform-updated', async () => {
        clearPermissionCache();
    });

    GlobalEventBus.addListener(owner, 'user-updated', async () => {
        clearPermissionCache();
    });

    const admins = computed(() => {
        if (organization.value) {
            return organization.value?.admins ?? [];
        }

        // Platform scope
        return platform.value.admins ?? [];
    });

    const permissionContextCache = shallowRef(new WeakMap<User, ContextPermissions>());
    const apiContextCache = shallowRef(new WeakMap<ApiUser, {
        permissions: LoadedPermissions | null;
        unloadedPermissions: Permissions | null;
    }>());

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
    const hasFullAccess = (user: User) => getPermissions(user)?.hasFullAccess() ?? false;
    const hasEmptyAccess = (user: User) => getPermissions(user)?.isEmpty ?? true;
    const memberHasFullAccess = (member: MemberAdmin) => !!member.users.find(u => hasFullAccess(u));
    const memberHasNoRoles = (member: MemberAdmin) => member.users.every(u => hasEmptyAccess(u));

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
        if (organization.value) {
            return organization.value?.admins?.push(user);
        }

        // Platform scope
        return platform.value.admins?.push(user);
    };

    const dropFromMemory = (user: UserWithMembers) => {
        if (organization.value) {
            const index = organization.value?.admins?.findIndex(u => u.id == user.id);

            if (index !== undefined && index !== -1) {
                organization.value?.admins?.splice(index, 1);
            }
            return;
        }

        // Platform scope
        const index = platform.value.admins?.findIndex(u => u.id == user.id);

        if (index !== undefined && index !== -1) {
            platform.value.admins?.splice(index, 1);
        }
    };

    return { hasEmptyAccess, reload, memberHasFullAccess, memberHasNoRoles, loading, admins, reloadPromise, sortedAdmins, sortedMembers, getPermissions, getUnloadedPermissions, getPermissionsPatch, pushInMemory, dropFromMemory, clearPermissionCache };
}
