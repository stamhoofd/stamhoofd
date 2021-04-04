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
 * Represents both EncryptedMemberWithRegistrations and MemberWithRegistrations
 */
export interface UnknownMemberWithRegistrations {
    id: string
    registrations: Registration[]
    firstName: string
}