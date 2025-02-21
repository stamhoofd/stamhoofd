import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { useOrganization, usePlatform } from '@stamhoofd/components';
import { ContextPermissions, usePlatformManager } from '@stamhoofd/networking';
import { GroupType, PermissionLevel, PermissionRoleForResponsibility, Permissions, PlatformFamily, PlatformMember, User, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, onActivated } from 'vue';
import { useReloadAdmins } from './useReloadAdmins';

export function useAdmins() {
    const organization = useOrganization();
    const platformManager = usePlatformManager();
    const platform = usePlatform();
    const { reload, reloadPromise } = useReloadAdmins();

    const loading = computed(() => {
        if (organization.value) {
            return organization.value?.admins === undefined || organization.value?.admins === null;
        }

        // Platform scope
        return platformManager.value.$platform.admins === undefined || platformManager.value.$platform.admins === null;
    });

    if (loading.value) {
        reload();
    }

    onActivated(() => {
        // Reload admins
        reload();
    });

    const admins = computed(() => {
        if (organization.value) {
            return organization.value?.admins ?? [];
        }

        // Platform scope
        return platformManager.value.$platform.admins ?? [];
    });

    const getPermissions = (user: User) => {
        return new ContextPermissions(UserWithMembers.create(user), organization, platformManager.value.$platform, { allowInheritingPermissions: false }).permissions;
    };

    const getUnloadedPermissions = (user: User) => {
        return new ContextPermissions(UserWithMembers.create(user), organization, platformManager.value.$platform, { allowInheritingPermissions: false }).unloadedPermissions;
    };

    const getPermissionsPatch = (user: User, patch: AutoEncoderPatchType<Permissions> | null): AutoEncoderPatchType<UserPermissions> | UserPermissions => {
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

    function isExternalUser(a: UserWithMembers) {
        if (!a.memberId) {
            return true;
        }
        const member = a.members.members.find(m => m.id === a.memberId!);
        if (!member) {
            return true;
        }
        const registrations = organization.value ? member.registrations.filter(r => r.organizationId === organization.value?.id) : member.registrations;
        return !registrations.find(r =>
            r.registeredAt !== null && r.deactivatedAt === null && r.group.type === GroupType.Membership
            && r.group.periodId === (organization.value?.period.period.id ?? platform.value.period.id),
        );
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
    const memberHasFullAccess = (member: PlatformMember) => !!member.patchedMember.users.find(u => u.memberId === member.id && hasFullAccess(u));

    const sortedMembers = computed(() => {
        const members = new Map<string, PlatformMember>();
        for (const admin of admins.value) {
            const adminMembers = PlatformFamily.createSingles(admin.members, {
                contextOrganization: organization.value,
                platform: platform.value,
            });

            for (const m of adminMembers) {
                if (m.getResponsibilities(organization.value).length === 0) {
                    continue;
                }
                if (!members.has(m.id)) {
                    members.set(m.id, m);
                }
            }
        }

        return [...members.values()].sort((a, b) => Sorter.stack(
            Sorter.byBooleanValue(memberHasFullAccess(a), memberHasFullAccess(b)),
            Sorter.byStringValue(a.patchedMember.name, b.patchedMember.name),
        ));
    });

    // Sorted members todo

    const pushInMemory = (user: UserWithMembers) => {
        if (organization.value) {
            return organization.value?.admins?.push(user);
        }

        // Platform scope
        return platformManager.value.$platform.admins?.push(user);
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
        const index = platformManager.value.$platform.admins?.findIndex(u => u.id == user.id);

        if (index !== undefined && index !== -1) {
            platformManager.value.$platform.admins?.splice(index, 1);
        }
    };

    return { loading, admins, reloadPromise, sortedAdmins, sortedMembers, getPermissions, getUnloadedPermissions, getPermissionsPatch, pushInMemory, dropFromMemory };
}
