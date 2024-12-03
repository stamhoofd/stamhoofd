import { Platform } from '../Platform.js';

export function uuidToName(uuid: string) {
    // Look up in UUID library list
    const objectLists
     = [
         Platform.shared.config.premiseTypes,
         Platform.shared.config.eventTypes,
         Platform.shared.config.defaultAgeGroups,
         Platform.shared.config.tags,
         Platform.shared.config.recordsConfiguration.recordCategories,
         Platform.shared.config.membershipTypes,
     ];

    for (const list of objectLists) {
        for (const object of list) {
            if (object.id === uuid) {
                return object.name;
            }
        }
    }
    return null;
}
