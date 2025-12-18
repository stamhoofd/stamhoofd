export enum GroupType {
    /**
     * registration as a member at an organization - for a specific age group (most of the time)
     */
    Membership = 'Membership',

    /**
     * Waiting list of any other group
     */
    WaitingList = 'WaitingList',

    /**
     * Activity
     */
    EventRegistration = 'EventRegistration',
    // idea: EventPreRegistration = "EventPreRegistration", // let know in advance that you want to join
    // idea: EventAttendance = "EventAttendance", // attendance list for an event, by admins only
}

export function getGroupTypeName(type: GroupType) {
    switch (type) {
        case GroupType.Membership:
            return $t('877284d7-31b4-4857-a963-405b4139adc2');
        case GroupType.WaitingList:
            return $t('565a7968-e547-411e-aaff-6f936c128d5f');
        case GroupType.EventRegistration:
            return $t('614dbf30-ddf8-4e85-9da3-cc8d30f7ac77');
    }
}
