import { CachedBalance, Member, MemberResponsibilityRecord, MemberWithRegistrations, User } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { AuditLogSource, MemberDetails, Permissions, UserPermissions } from '@stamhoofd/structures';
import crypto from 'crypto';
import basex from 'base-x';
import { AuditLogService } from '../services/AuditLogService';
import { Formatter } from '@stamhoofd/utility';
import { QueueHandler } from '@stamhoofd/queues';

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
    async onChangeMember(member: MemberWithRegistrations, unlinkUsers: boolean = false) {
        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            const { userEmails, parentAndUnverifiedEmails } = this.getMemberAccessEmails(member.details);

            // Make sure all these users have access to the member
            for (const email of userEmails) {
            // Link users that are found with these email addresses.
                await this.linkUser(email, member, false, true);
            }

            for (const email of parentAndUnverifiedEmails) {
                if (userEmails.includes(email)) {
                    continue;
                }

                // Link parents and unverified emails
                // Now we add the responsibility permissions to the parent if there are no userEmails
                const asParent = userEmails.length > 0 || !member.details.unverifiedEmails.includes(email) || member.details.defaultAge < 16;
                await this.linkUser(email, member, asParent, true);
            }

            if (unlinkUsers && !member.details.parentsHaveAccess) {
            // Remove access of users that are not in this list
            // NOTE: we should only do this once a year (preferably on the birthday of the member)
            // only once because otherwise users loose the access to a member during the creation of the member, or when they have changed their email address
            // users can regain access to a member after they have lost control by using the normal verification flow when detecting duplicate members

                for (const user of member.users) {
                    if (!userEmails.includes(user.email) && !parentAndUnverifiedEmails.includes(user.email)) {
                        await this.unlinkUser(user, member);
                    }
                }
            }
            else {
            // Only auto unlink users that do not have an account
                for (const user of member.users) {
                    if (!userEmails.includes(user.email) && !parentAndUnverifiedEmails.includes(user.email)) {
                        if (!user.hasAccount()) {
                            await this.unlinkUser(user, member);
                        }
                        else {
                        // Make sure only linked as a parent, not as user self
                        // This makes sure we don't inherit permissions and aren't counted as 'being' the member
                            await this.linkUser(user.email, member, true);
                        }
                    }
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
    }

    getMemberAccessEmails(details: MemberDetails) {
        const userEmails = [...details.alternativeEmails];

        if (details.email) {
            userEmails.push(details.email);
        }

        const unverifiedEmails: string[] = details.unverifiedEmails;
        const parentAndUnverifiedEmails = details.parentsHaveAccess ? details.parents.flatMap(p => p.email ? [p.email, ...p.alternativeEmails] : p.alternativeEmails).concat(unverifiedEmails) : details.unverifiedEmails;

        return {
            userEmails,
            parentAndUnverifiedEmails,
            emails: userEmails.concat(parentAndUnverifiedEmails),
        };
    }

    doesEmailHaveAccess(details: MemberDetails, email: string) {
        const { emails } = this.getMemberAccessEmails(details);
        return emails.includes(email);
    }

    async onDeleteMember(member: MemberWithRegistrations) {
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

    async updateInheritedPermissions(user: User) {
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

        // Platform permissions
        user.permissions.clearEmptyPermissions();

        if (user.permissions.isEmpty) {
            user.permissions = null;
        }

        await user.save();
    }

    async unlinkUser(user: User, member: MemberWithRegistrations) {
        console.log('Removing access for ' + user.id + ' to member ' + member.id);
        await Member.users.reverse('members').unlink(user, member);

        // Update balance of this user, as it could have changed
        await this.updateUserBalance(user.id, member.id);

        if (user.memberId === member.id) {
            user.memberId = null;
        }

        // Update model relation to correct response
        const existingIndex = member.users.findIndex(u => u.id === user.id);
        if (existingIndex !== -1) {
            member.users.splice(existingIndex, 1);
        }

        await this.updateInheritedPermissions(user);
    }

    async linkUser(email: string, member: MemberWithRegistrations, asParent: boolean, updateNameIfEqual = true) {
        // This needs to happen in the queue to prevent creating duplicate users in the database
        await QueueHandler.schedule('link-user/' + email, async () => {
            console.log('Linking user', email, 'to member', member.id, 'as parent', asParent, 'update name if equal', updateNameIfEqual);

            let user = member.users.find(u => u.email.toLocaleLowerCase() === email.toLocaleLowerCase()) ?? await User.getForAuthentication(member.organizationId, email, { allowWithoutAccount: true });

            if (user) {
                // console.log("Giving an existing user access to a member: " + user.id + ' - ' + member.id)
                if (!asParent) {
                    if (user.memberId && user.memberId !== member.id) {
                        console.error('Found conflicting user with multiple members', user.id, 'members', user.memberId, 'to', member.id);

                        const otherMember = await Member.getWithRegistrations(user.memberId);

                        if (otherMember) {
                            if (otherMember.registrations.length > 0 && member.registrations.length === 0) {
                                // Choose the other member
                                // don't make changes
                                console.error('Resolved to current member - no changes made');
                                return;
                            }

                            const responsibilities = await this.getResponsibilitiesForMembers([otherMember.id, member.id]);
                            const responsibilitiesOther = responsibilities.filter(r => r.memberId === otherMember.id);
                            const responsibilitiesCurrent = responsibilities.filter(r => r.memberId === member.id);

                            if (responsibilitiesOther.length >= responsibilitiesCurrent.length) {
                                console.error('Resolved to current member because of more responsibilities - no changes made');
                                return;
                            }
                        }
                    }

                    if (updateNameIfEqual) {
                        user.firstName = member.details.firstName;
                        user.lastName = member.details.lastName;
                    }
                    user.memberId = member.id;
                    await this.updateInheritedPermissions(user);
                }
                else {
                    let shouldSave = false;

                    if (!user.firstName && !user.lastName) {
                        const parents = member.details.parents.filter(p => p.email === email);
                        if (parents.length === 1) {
                            if (updateNameIfEqual) {
                                user.firstName = parents[0].firstName;
                                user.lastName = parents[0].lastName;
                            }
                            shouldSave = true;
                        }
                    }

                    if (user.firstName === member.details.firstName && user.lastName === member.details.lastName) {
                        user.firstName = null;
                        user.lastName = null;
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

                if (!asParent) {
                    if (updateNameIfEqual) {
                        user.firstName = member.details.firstName;
                        user.lastName = member.details.lastName;
                    }
                    user.memberId = member.id;
                    await this.updateInheritedPermissions(user);
                }
                else {
                    const parents = member.details.parents.filter(p => p.email === email);
                    if (parents.length === 1) {
                        if (updateNameIfEqual) {
                            user.firstName = parents[0].firstName;
                            user.lastName = parents[0].lastName;
                        }
                    }

                    if (user.firstName === member.details.firstName && user.lastName === member.details.lastName) {
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
        const memberBalances = await CachedBalance.getForObjects([memberId]);
        if (memberBalances.length > 0) {
            const organizationIds = Formatter.uniqueArray(memberBalances.map(b => b.organizationId));
            for (const organizationId of organizationIds) {
                await CachedBalance.updateForUsers(organizationId, [userId]);
            }
        }
    }
}

export const MemberUserSyncer = new MemberUserSyncerStatic();
