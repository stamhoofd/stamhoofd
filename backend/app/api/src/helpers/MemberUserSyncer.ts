import { CachedBalance, Member, MemberResponsibilityRecord, MemberWithUsers, Organization, Platform, User } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL } from '@stamhoofd/sql';
import { AuditLogSource, MemberDetails, PermissionRole, Permissions, ReceivableBalanceType, UserPermissions } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import basex from 'base-x';
import crypto from 'crypto';
import { AuditLogService } from '../services/AuditLogService.js';

const ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ'; // Note: we removed 0, O, I and l to make it easier for humans
const customBase = basex(ALPHABET);

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

export class MemberUserSyncerStatic {
    /**
     * Call when:
     * - responsibilities have changed
     * - email addresses have changed
     */
    async onChangeMember(member: Member) {
        await QueueHandler.schedule('change-member/' + member.id, async () => {
            await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                // Note: Refresh member data is not really required because we'll just schedule a new task if it changes again
                // Reload member users
                await Member.users.load(member);
                if (!Member.users.isLoaded(member)) {
                    throw new Error('Failed to load users for member ' + member.id);
                }

                const { userEmails, parentEmails, unverifiedEmails, allEmails } = this.getMemberAccessEmails(member.details);

                // Make sure all these users have access to the member
                for (const email of userEmails) {
                    // Link users that are found with these email addresses.
                    await this.linkUser(email, member, false, {
                        firstName: member.details.firstName,
                        lastName: member.details.lastName,
                    });
                }

                if (member.details.calculatedParentsHaveAccess) {
                    for (const parent of member.details.parents) {
                        for (const email of parent.getEmails()) {
                            if (userEmails.includes(email.toLocaleLowerCase())) {
                                continue;
                            }

                            // Link parents and unverified emails
                            await this.linkUser(email, member, true, {
                                firstName: parent.firstName,
                                lastName: parent.lastName,
                            });
                        }
                    }
                }

                // Make sure all these users have access to the member
                for (const email of unverifiedEmails) {
                    if (userEmails.includes(email)) {
                        continue;
                    }
                    if (parentEmails.includes(email)) {
                        continue;
                    }

                    // Do not update name + do not link as member (no permissions inheritance here)
                    await this.linkUser(email, member, true);
                }

                // Only auto unlink users that do not have an account
                // note: we create a copy of the users array here because it is modified in the loop
                for (const user of [...member.users]) {
                    if (!allEmails.includes(user.email.toLocaleLowerCase())) {
                        if (!user.hasAccount()) {
                            await this.unlinkUser(user, member);
                        }
                        else {
                            // Make sure only linked as a parent, not as user self
                            // This makes sure we don't inherit permissions and aren't counted as 'being' the member
                            await this.linkUser(user.email, member, true);
                        }
                    }
                    else if (!member.details.calculatedParentsHaveAccess && parentEmails.includes(user.email.toLocaleLowerCase()) && !userEmails.includes(user.email.toLocaleLowerCase())) {
                        await this.unlinkUser(user, member);
                    }
                }

                if (member.details.securityCode === null) {
                    console.log('Generating security code for member ' + member.id);

                    const length = 16;
                    const code = customBase.encode(await randomBytes(100)).toUpperCase().substring(0, length);
                    member.details.securityCode = code;
                    await member.save();
                }
            });
        });
    }

    getMemberAccessEmails(details: MemberDetails) {
        const userEmails = details.getMemberEmails().map(e => e.toLocaleLowerCase());
        const parentEmails = details.getParentEmails().map(e => e.toLocaleLowerCase());
        const unverifiedEmails = details.unverifiedEmails.map(e => e.toLocaleLowerCase());
        const allEmails = [...userEmails, ...parentEmails, ...unverifiedEmails];

        return {
            allEmails,
            userEmails,
            parentEmails,
            unverifiedEmails,
        };
    }

    doesEmailHaveAccess(details: MemberDetails, email: string) {
        const { allEmails } = this.getMemberAccessEmails(details);
        return allEmails.includes(email.toLocaleLowerCase());
    }

    async onDeleteMember(member: MemberWithUsers) {
        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            for (const u of member.users) {
                console.log('Unlinking user ' + u.email + ' from deleted member ' + member.id);
                await this.unlinkUser(u, member);
            }
        });
    }

    async getResponsibilitiesForMembers(memberIds: string[]) {
        const rows = await SQL.select()
            .from(SQL.table(MemberResponsibilityRecord.table))
            .where(SQL.column('memberId'), memberIds)
            .where(SQL.column('endDate'), null)
            .fetch();

        return MemberResponsibilityRecord.fromRows(rows, MemberResponsibilityRecord.table);
    }

    async updatePermissionsForOrganization(organizationId: string) {
        const admins = await User.getAdmins(organizationId);
        for (const admin of admins) {
            await this.updateInheritedPermissions(admin);
        }
    }

    async updatePermissionsForPlatform() {
        const admins = await User.getPlatformAdmins();
        for (const admin of admins) {
            await this.updateInheritedPermissions(admin);
        }
    }

    async updateInheritedPermissions(user: User) {
        // Fetch all members for this user
        const responsibilities = user.memberId ? (await this.getResponsibilitiesForMembers([user.memberId])) : [];

        // Check if the member has active registrations
        // otherwise -> do not inherit any permissions

        user.permissions = user.permissions ?? UserPermissions.create({});

        // Group responsibilities by organization
        const responsibilitiesByOrganization: Map<string | null, MemberResponsibilityRecord[]> = new Map();

        responsibilitiesByOrganization.set(null, []);

        for (const organizationId of user.permissions.organizationPermissions.keys()) {
            // Make sure we reset responsibilities for organizations that are not in the list
            responsibilitiesByOrganization.set(organizationId, []);
        }

        for (const responsibility of responsibilities) {
            const v = responsibilitiesByOrganization.get(responsibility.organizationId) ?? [];
            responsibilitiesByOrganization.set(responsibility.organizationId, v);
            v.push(responsibility);
        }

        for (const organizationId of responsibilitiesByOrganization.keys()) {
            if (organizationId === null) {
                const patch = user.permissions.convertPlatformPatch(
                    Permissions.patch({
                        responsibilities: (responsibilitiesByOrganization.get(organizationId) ?? []).map(r => r.getBaseStructure()) as any,
                    }),
                );
                user.permissions = user.permissions.patch(patch);
            }
            else {
                const patch = user.permissions.convertPatch(
                    Permissions.patch({
                        responsibilities: (responsibilitiesByOrganization.get(organizationId) ?? []).map(r => r.getBaseStructure()) as any,
                    }),
                    organizationId,
                );
                user.permissions = user.permissions.patch(patch);
            }
        }

        // Update roles (remove roles from permissions that no longer exist)
        for (const organizationId of user.permissions.organizationPermissions.keys()) {
            const organizationPermissions = user.permissions.organizationPermissions.get(organizationId);
            if (!organizationPermissions) {
                continue;
            }

            const roles = organizationPermissions.roles;
            if (roles.length === 0) {
                continue;
            }

            const organization = await Organization.getByID(organizationId);
            if (!organization) {
                // Delete key
                user.permissions.organizationPermissions.delete(organizationId);
                continue;
            }

            const availableRoles = organization.privateMeta.roles;
            const newRoles: PermissionRole[] = [];
            for (const role of roles) {
                const roleInfo = availableRoles.find(r => r.id === role.id);
                if (roleInfo) {
                    role.name = roleInfo.name;
                    newRoles.push(role);
                }
            }
            organizationPermissions.roles = newRoles;
        }

        const globalPermissions = user.permissions.globalPermissions;
        if (globalPermissions) {
            const roles = globalPermissions.roles;
            if (roles.length > 0) {
                const availableRoles = (await Platform.getSharedPrivateStruct()).privateConfig.roles;
                const newRoles: PermissionRole[] = [];
                for (const role of roles) {
                    const roleInfo = availableRoles.find(r => r.id === role.id);
                    if (roleInfo) {
                        role.name = roleInfo.name;
                        newRoles.push(role);
                    }
                }
                globalPermissions.roles = newRoles;
            }
        }

        // Platform permissions
        user.permissions.clearEmptyPermissions();

        if (user.permissions.isEmpty) {
            user.permissions = null;
        }

        await user.save();
    }

    async unlinkUser(user: User, member: MemberWithUsers) {
        console.log('Removing access for ' + user.id + ' to member ' + member.id);
        await Member.users.reverse('members').unlink(user, member);

        // Update balance of this user, as it could have changed
        await this.updateUserBalance(user.id, member.id);

        if (user.memberId === member.id) {
            user.memberId = null;

            if (user.firstName === member.details.firstName && user.lastName === member.details.lastName) {
                user.firstName = null;
                user.lastName = null;
            }
        }

        // Update model relation to correct response
        const existingIndex = member.users.findIndex(u => u.id === user.id);
        if (existingIndex !== -1) {
            member.users.splice(existingIndex, 1);
        }

        await this.updateInheritedPermissions(user);
    }

    private async resolveUserWithMultipleMembers(currentMemberId: string, otherMember: Member): Promise<'current' | 'other'> {
        const otherMemberId = otherMember.id;
        const responsibilities = await this.getResponsibilitiesForMembers([otherMemberId, currentMemberId]);
        const responsibilitiesOther = responsibilities.filter(r => r.memberId === otherMemberId && r.getBaseStructure().isActive);
        const responsibilitiesCurrent = responsibilities.filter(r => r.memberId === currentMemberId && r.getBaseStructure().isActive);

        if (responsibilitiesOther.length > 0 && responsibilitiesCurrent.length === 0) {
            return 'other';
        }

        if (responsibilitiesCurrent.length > 0 && responsibilitiesOther.length === 0) {
            return 'current';
        }
        const currentMember = await Member.getByID(currentMemberId);
        if (!currentMember) {
            return 'other';
        }

        if (responsibilitiesOther.length > 0 && responsibilitiesCurrent.length > 0) {
            // Resolve to oldest created member (this is always the most secure option)
            if (currentMember.createdAt <= otherMember.createdAt) {
                return 'current';
            }

            return 'other';
        }

        // Resolve to newest member
        if (currentMember.createdAt > otherMember.createdAt) {
            return 'current';
        }

        return 'other';
    }

    async linkUser(email: string, member: MemberWithUsers, asParent: boolean, name: { firstName: string; lastName: string } | null = null) {
        // This needs to happen in the queue to prevent creating duplicate users in the database
        await QueueHandler.schedule('link-user/' + email, async () => {
            let user = member.users.find(u => u.email.toLocaleLowerCase() === email.toLocaleLowerCase()) ?? await User.getForAuthentication(member.organizationId, email, { allowWithoutAccount: true });

            if (user) {
                if (!asParent) {
                    let setMemberId = true;
                    if (user.memberId && user.memberId !== member.id) {
                        const resolveTo = await this.resolveUserWithMultipleMembers(user.memberId, member);

                        if (resolveTo === 'current') {
                            // Do not change memberId
                            setMemberId = false;
                        }
                    }

                    if (setMemberId) {
                        if (name) {
                            user.firstName = name.firstName;
                            user.lastName = name.lastName;
                        }
                        user.memberId = member.id;
                    }
                    await this.updateInheritedPermissions(user);
                }
                else {
                    let shouldSave = false;

                    // Clear clearly wrong name
                    if (user.firstName?.toLocaleLowerCase() === member.details.firstName?.toLocaleLowerCase() && user.lastName?.toLocaleLowerCase() === member.details.lastName?.toLocaleLowerCase()) {
                        if (!name || (name.firstName !== user.firstName && name.lastName !== user.lastName)) {
                            user.firstName = null;
                            user.lastName = null;
                            shouldSave = true;
                        }
                    }

                    if (!user.firstName && !user.lastName) {
                        if (name) {
                            user.firstName = name.firstName;
                            user.lastName = name.lastName;
                        }
                        shouldSave = true;
                    }

                    if (user.memberId === member.id) {
                        // Unlink: parents are never 'equal' to the member
                        user.memberId = null;
                        await this.updateInheritedPermissions(user);
                    }
                    if (shouldSave) {
                        await user.save();
                    }
                }
            }
            else {
                // Create a new placeholder user
                user = new User();
                user.organizationId = member.organizationId;
                user.email = email;
                if (name) {
                    user.firstName = name.firstName;
                    user.lastName = name.lastName;
                }

                if (!asParent) {
                    user.memberId = member.id;
                    await this.updateInheritedPermissions(user);
                }
                else {
                    if (!name && user.firstName?.toLocaleLowerCase() === member.details.firstName?.toLocaleLowerCase() && user.lastName?.toLocaleLowerCase() === member.details.lastName?.toLocaleLowerCase()) {
                        user.firstName = null;
                        user.lastName = null;
                    }

                    await user.save();
                }

                console.log('Created new (placeholder) user that has access to a member: ' + user.id);
            }

            // Update model relation to correct response
            if (!member.users.find(u => u.id === user.id)) {
                await Member.users.reverse('members').link(user, [member]);
                member.users.push(user);

                // Update balance of this user, as it could have changed
                await this.updateUserBalance(user.id, member.id);
            }
        });
    }

    /**
     * Update the balance after making a change in linked member/users
     */
    async updateUserBalance(userId: string, memberId: string) {
        // Update balance of this user, as it could have changed
        const memberBalances = await CachedBalance.getForObjects([memberId], null, ReceivableBalanceType.member);
        if (memberBalances.length > 0) {
            const organizationIds = Formatter.uniqueArray(memberBalances.map(b => b.organizationId));
            for (const organizationId of organizationIds) {
                await CachedBalance.updateForUsers(organizationId, [userId]);
            }
        }
    }
}

export const MemberUserSyncer = new MemberUserSyncerStatic();
