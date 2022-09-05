import { Session } from "@stamhoofd/networking"

/**
 * Update group sizes in memory so we don't need to refresh anything from the server
 */
export class GroupSizeUpdater {
    groupMap: Map<string, number> = new Map()
    waitingListMap: Map<string, number> = new Map()

    add({groupId, waitingList}: {groupId: string, waitingList?: boolean}, difference = 1) {
        if (waitingList) {
            this.waitingListMap.set(groupId, (this.waitingListMap.get(groupId) || 0) + difference)
        } else {
            this.groupMap.set(groupId, (this.groupMap.get(groupId) || 0) + difference)
        }
    }

    save(session: Session) {
        let updateOrganization = false
        for (const [groupId, count] of this.groupMap) {
            const group = session.organization?.groups.find(g => g.id === groupId)
            if (group) {
                if (group.settings.registeredMembers !== null) {
                    group.settings.registeredMembers = Math.max(0, group.settings.registeredMembers + count)
                    updateOrganization = true
                }
            }
        }

        for (const [groupId, count] of this.waitingListMap) {
            const group = session.organization?.groups.find(g => g.id === groupId)
            if (group) {
                if (group.settings.waitingListSize !== null) {
                    group.settings.waitingListSize =  Math.max(0, group.settings.waitingListSize + count)
                    updateOrganization = true
                }
            }
        }

        if (updateOrganization) {
            // Save organization to disk
            session.callListeners("organization")
        }
    }
}