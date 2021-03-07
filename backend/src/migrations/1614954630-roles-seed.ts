import { Migration } from '@simonbackx/simple-database';
import { GroupCategory, OrganizationTypeHelper, PermissionLevel, PermissionRole, PermissionRoleDetailed } from '@stamhoofd/structures';
import { Group } from '../models/Group';
import { Organization } from '../models/Organization';
import { Group as GroupStruct } from "@stamhoofd/structures";
import { User } from '../models/User';
import { group } from 'console';
import { Sorter } from '@stamhoofd/utility';
import { Invite } from '../models/Invite';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
       

        const d = new Date()

        const invites = (await Invite.where({ 
            organizationId: organization.id, 
            permissions: {
                value: null,
                sign: "!="
            }
        })).filter(invite => invite.validUntil >= d)

         // Get all admins
        const users = [
            ...await User.where({ 
                organizationId: organization.id, 
                permissions: {
                    value: null,
                    sign: "!="
                }
            }), 
            ...invites
        ]
        
        const map = new Map<string, PermissionRoleDetailed>()
        const groups = (await Group.where({ organizationId: organization.id }))

        for (const user of users) {
            if (!user.permissions) {
                console.error("PERMISSIONS MISSING!")
                continue
            }

            for (const { groupId, level } of user.permissions.groups) {
                if (level === PermissionLevel.None) {
                    continue
                }
                let role: PermissionRoleDetailed = map.get(groupId)!
                const group = groups.find(g => g.id === groupId)
                if (!group) {
                    continue
                }
                if (!role) {
                    role = PermissionRoleDetailed.create({
                        name: group.settings.name
                    })
                    group.privateSettings.permissions.write.push(PermissionRole.create(role))
                    await group.save()
                    map.set(groupId, role)
                }
                if (user.permissions.roles.find(r => r.id === role.id)) {
                    continue
                }
                user.permissions.roles.push(role)
            }

            if (user.permissions.level === PermissionLevel.Read || user.permissions.level === PermissionLevel.Write) {
                // Not supported in frontend atm
                user.permissions.level = PermissionLevel.None

                // Give access to all groups
                for (const group of groups) {
                    let role: PermissionRoleDetailed = map.get(group.id)!
                    if (!role) {
                        role = PermissionRoleDetailed.create({
                            name: group.settings.name
                        })
                        group.privateSettings.permissions.write.push(PermissionRole.create(role))
                        await group.save()
                        map.set(group.id, role)
                    }
                    if (user.permissions.roles.find(r => r.id === role.id)) {
                        continue
                    }
                    user.permissions.roles.push(role)
                }
            }
            await user.save()
        }

        for (const role of map.values()) {
            console.log(role.name)
            organization.privateMeta.roles.push(role)
        }
        await organization.save()
        
    }
});


