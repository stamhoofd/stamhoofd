import { EmergencyContact } from '@stamhoofd/structures';
import { GeneralMemberDetailsMatcher } from '../../GeneralMemberDetailsMatcher';

/**
 * Imports the combined 'Alle noodcontacten' column, which lists one emergency contact per line (as produced by the
 * export). Each line is parsed back into an EmergencyContact.
 */
export class EmergencyContactsColumnMatcher extends GeneralMemberDetailsMatcher<EmergencyContact[]> {
    parse(v: string): EmergencyContact[] {
        return v
            .split(/\r?\n|;/)
            .map(line => EmergencyContact.fromString(line))
            .filter((contact): contact is EmergencyContact => contact !== null);
    }
}
