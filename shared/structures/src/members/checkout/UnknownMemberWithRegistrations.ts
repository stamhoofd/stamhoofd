import { MemberDetails } from "../MemberDetails";

/**
 * Represent both model and structures
 */
interface Registration {
    waitingList: boolean
    groupId: string
    cycle: number
    registeredAt: Date | null
    deactivatedAt: Date | null
    reservedUntil: Date | null
    canRegister: boolean
}
/**
 * Represents both MemberWithRegistrationsBlob and MemberWithRegistrations
 */
export interface UnknownMemberWithRegistrations {
    id: string
    registrations: Registration[]
    details: MemberDetails
}
