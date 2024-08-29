export enum GroupType {
    /**
     * registration as a member at an organization - for a specific age group (most of the time)
     */
    "Membership" = "Membership",

    /**
     * Waiting list of any other group
     */
    "WaitingList" = "WaitingList",

    /**
     * Activity
     */
    "EventRegistration" = "EventRegistration",
    // idea: EventPreRegistration = "EventPreRegistration", // let know in advance that you want to join
    // idea: EventAttendance = "EventAttendance", // attendance list for an event, by admins only
}
