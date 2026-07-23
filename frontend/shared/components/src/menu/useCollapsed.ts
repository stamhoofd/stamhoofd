import { reactive } from 'vue';
import { Storage } from '@stamhoofd/networking/Storage';

export function useCollapsed(globalIdentifier: string, defaultCollapsed = false) {
    const collapsedSections = reactive(new Set<string>());

    const key = defaultCollapsed ? 'opened-' : 'collapsed-';

    const load = async () => {
        try {
            const value = await Storage.keyValue.getItem(key + globalIdentifier);
            if (value) {
                const values = JSON.parse(value) as string[];
                for (const value of values) {
                    collapsedSections.add(value);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const save = async () => {
        try {
            const values = [...collapsedSections.values()];
            await Storage.keyValue.setItem(key + globalIdentifier, JSON.stringify(values));
        } catch (e) {
            console.error(e);
        }
    };

    load().catch(console.error);

    return {
        toggle(id: string) {
            if (collapsedSections.has(id)) {
                collapsedSections.delete(id);
                save().catch(console.error);
            } else {
                collapsedSections.add(id);
                save().catch(console.error);
            }
        },
        isCollapsed(id: string) {
            if (defaultCollapsed === false) {
                return collapsedSections.has(id);
            }
            return !collapsedSections.has(id);
        },
    };
}
