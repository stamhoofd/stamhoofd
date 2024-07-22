import { Member, MemberResponsibilityRecord, MemberWithRegistrations, User } from "@stamhoofd/models";
import { SQL } from "@stamhoofd/sql";
import { Permissions, UserPermissions } from "@stamhoofd/structures";

export class MemberUserSyncerStatic {
    /**
     * Call when:
     * - responsibilities have changed
     * - email addresses have changed
     */
    async onChangeMember(member: MemberWithRegistrations) {
        const userEmails = [...member.details.alternativeEmails]

        if (member.details.email) {
            userEmails.push(member.details.email)
        }

        const parentEmails = member.details.parentsHaveAccess ? member.details.parents.flatMap(p => p.email ? [p.email, ...p.alternativeEmails] : p.alternativeEmails) : []

        // Make sure all these users have access to the member
        for (const email of userEmails) {
            // Link users that are found with these email addresses.
            await this.linkUser(email, member, false)
        }

        for (const email of parentEmails) {
            // Link parents
            await this.linkUser(email, member, true)
        }

        // Remove access of users that are not in this list
        for (const user of member.users) {
            if (!userEmails.includes(user.email) && !parentEmails.includes(user.email)) {
                await this.unlinkUser(user, member)
            }
        }

    }

    async onDeleteMember(member: MemberWithRegistrations) {
        for (const u of member.users) {
            console.log("Unlinking user "+u.email+" from deleted member "+member.id)
            await this.unlinkUser(u, member)
        }
    }

    async getResponsibilitiesForMembers(memberIds: string[]) {
        const rows = await SQL.select()
            .from(SQL.table(MemberResponsibilityRecord.table))
            .where(SQL.column("memberId"), memberIds)
            .where(SQL.column("endDate"), null)
            .fetch();

        return MemberResponsibilityRecord.fromRows(rows, MemberResponsibilityRecord.table)
    }

    async updateInheritedPermissions(user: User) {
        const responsibilities = user.memberId ? (await this.getResponsibilitiesForMembers([user.memberId])) : []

        // Check if the member has active registrations
        // otherwise -> do not inherit any permissions

        user.permissions = user.permissions ?? UserPermissions.create({})

        // Group responsibilities by organization
        const responsibilitiesByOrganization: Map<string|null, MemberResponsibilityRecord[]> = new Map()

        responsibilitiesByOrganization.set(null, [])

        for (const organizationId of user.permissions.organizationPermissions.keys()) {
            // Make sure we reset responsibilities for organizations that are not in the list
            responsibilitiesByOrganization.set(organizationId, [])
        }

        for (const responsibility of responsibilities) {
            const v = responsibilitiesByOrganization.get(responsibility.organizationId) ?? []
            responsibilitiesByOrganization.set(responsibility.organizationId, v)
            v.push(responsibility)
        }

        for (const organizationId of responsibilitiesByOrganization.keys()) {
            if (organizationId === null) {
                const patch = user.permissions.convertPlatformPatch(
                    Permissions.patch({
                        responsibilities: (responsibilitiesByOrganization.get(organizationId) ?? []).map(r => r.getStructure()) as any
                    })
                )
                user.permissions = user.permissions.patch(patch)
            } else {
                const patch = user.permissions.convertPatch(
                    Permissions.patch({
                        responsibilities: (responsibilitiesByOrganization.get(organizationId) ?? []).map(r => r.getStructure()) as any
                    }),
                    organizationId
                )
                user.permissions = user.permissions.patch(patch)
            }
            
        }

        // Platform permissions
        user.permissions.clearEmptyPermissions()

        if (user.permissions.isEmpty) {
            user.permissions = null;
        }

        await user.save()
    }

    async unlinkUser(user: User, member: MemberWithRegistrations) {
        console.log("Removing access for "+ user.id +" to member "+member.id)
        await Member.users.reverse("members").unlink(user, member)

        if (user.memberId === member.id) {
            user.memberId = null;
            await user.save()
        }

        // Update model relation to correct response
        const existingIndex = member.users.findIndex(u => u.id === user.id)
        if (existingIndex !== -1) {
            member.users.splice(existingIndex, 1)
        }

        await this.updateInheritedPermissions(user)
    }

    async linkUser(email: string, member: MemberWithRegistrations, asParent: boolean) {
        let user = member.users.find(u => u.email.toLocaleLowerCase() === email.toLocaleLowerCase()) ?? await User.getForAuthentication(member.organizationId, email, {allowWithoutAccount: true})

        if (user) {
            console.log("Giving an existing user access to a member: " + user.id + ' - ' + member.id)
            if (!asParent) {
                if (user.memberId && user.memberId !== member.id) {
                    console.error('Found conflicting user with multiple members', user.id, 'members', user.memberId, 'to', member.id)
                    
                    const otherMember = await Member.getWithRegistrations(user.memberId)

                    if (otherMember) {
                        if (otherMember.registrations.length > 0 && member.registrations.length === 0) {
                            // Choose the other member
                            // don't make changes
                            console.error('Resolved to current member - no changes made')
                            return
                        }

                        const responsibilities = await this.getResponsibilitiesForMembers([otherMember.id, member.id])
                        const responsibilitiesOther = responsibilities.filter(r => r.memberId === otherMember.id)
                        const responsibilitiesCurrent = responsibilities.filter(r => r.memberId === member.id)

                        if (responsibilitiesOther.length >= responsibilitiesCurrent.length) {
                            console.error('Resolved to current member because of more responsibilities - no changes made')
                            return
                        }
                    }
                }
                user.firstName = member.details.firstName
                user.lastName = member.details.lastName
                user.memberId = member.id;
                await this.updateInheritedPermissions(user)
            } else {
                if (user.memberId === member.id) {
                    // Unlink: parents are never 'equal' to the member
                    user.memberId = null;
                    await this.updateInheritedPermissions(user)
                }

                if (!user.firstName && !user.lastName) {
                    const parents = member.details.parents.filter(p => p.email === email)
                    if (parents.length === 1) {
                        user.firstName = parents[0].firstName
                        user.lastName = parents[0].lastName
                        await user.save()
                    }
                }

                if (user.firstName === member.details.firstName && user.lastName === member.details.lastName) {
                    user.firstName = null;
                    user.lastName = null;
                    await user.save()
                }
            }
        } else {
            // Create a new placeholder user
            user = new User()
            user.organizationId = member.organizationId
            user.email = email

            if (!asParent) {
                user.firstName = member.details.firstName
                user.lastName = member.details.lastName
                user.memberId = member.id;
                await this.updateInheritedPermissions(user)
            } else {
                const parents = member.details.parents.filter(p => p.email === email)
                if (parents.length === 1) {
                    user.firstName = parents[0].firstName
                    user.lastName = parents[0].lastName
                }

                if (user.firstName === member.details.firstName && user.lastName === member.details.lastName) {
                    user.firstName = null;
                    user.lastName = null;
                }

                await user.save()
            }

            console.log("Created new (placeholder) user that has access to a member: "+user.id)
        }

        // Update model relation to correct response
        if (!member.users.find(u => u.id === user.id)) {
            await Member.users.reverse("members").link(user, [member])
            member.users.push(user)
        }
    }
}

export const MemberUserSyncer = new MemberUserSyncerStatic()
