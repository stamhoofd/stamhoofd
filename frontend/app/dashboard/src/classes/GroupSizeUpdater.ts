import { SessionContext } from "@stamhoofd/networking"

/**
 * Update group sizes in memory so we don't need to refresh anything from the server
 */
export class GroupSizeUpdater {
    groupMap: Map<string, Map<number, number>> = new Map()
    waitingListMap: Map<string, Map<number, number>> = new Map()

    set({groupId, waitingList, cycle}: {groupId: string, waitingList?: boolean, cycle: number}, value: number) {
        if (waitingList) {
            const existing = this.waitingListMap.get(groupId) ?? new Map<number, number>()
            existing.set(cycle, value)
            this.waitingListMap.set(groupId, existing)
        } else {
            const existing = this.groupMap.get(groupId) ?? new Map<number, number>()
            existing.set(cycle, value)
            this.groupMap.set(groupId, existing)
        }
    }

    get({groupId, waitingList, cycle}: {groupId: string, waitingList?: boolean, cycle: number}) {
        if (waitingList) {
            const existing = this.waitingListMap.get(groupId) ?? new Map<number, number>()
            return existing.get(cycle) ?? 0
        } else {
            const existing = this.groupMap.get(groupId) ?? new Map<number, number>()
            return existing.get(cycle) ?? 0
        }
    }

    add({groupId, waitingList, cycle}: {groupId: string, waitingList?: boolean, cycle: number}, difference = 1) {
        this.set({groupId, waitingList, cycle}, this.get({groupId, waitingList, cycle}) + difference)
    }

    save(session: SessionContext) {
        let updateOrganization = false
        for (const [groupId, cycleMap] of this.groupMap) {
            const group = session.organization?.groups.find(g => g.id === groupId)
            if (group) {
                for (const [cycle, count] of cycleMap) {
                    const informationObject = group.cycle === cycle ? group.settings : group.settings.cycleSettings.get(cycle)
                    if (informationObject && informationObject.registeredMembers !== null) {
                        informationObject.registeredMembers = Math.max(0, informationObject.registeredMembers + count)
                        updateOrganization = true
                    }
                }
            }
        }

        for (const [groupId, cycleMap] of this.waitingListMap) {
            const group = session.organization?.groups.find(g => g.id === groupId)
            
            if (group) {
                for (const [cycle, count] of cycleMap) {
                    const informationObject = group.cycle === cycle ? group.settings : group.settings.cycleSettings.get(cycle)

                    if (informationObject && informationObject.waitingListSize !== null) {
                        informationObject.waitingListSize =  Math.max(0, informationObject.waitingListSize + count)
                        updateOrganization = true
                    }
                }
            }
        }

        if (updateOrganization) {
            // Save organization to disk
            session.callListeners("organization")
        }
    }
}