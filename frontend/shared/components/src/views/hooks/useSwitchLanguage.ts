import { I18nController } from '@stamhoofd/frontend-i18n';
import { LanguageHelper } from '@stamhoofd/structures';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';

export function useSwitchLanguage() {
    async function switchLanguage(event: MouseEvent) {
        const menu = new ContextMenu([
            I18nController.shared.availableLanguages.map((language) => {
                return new ContextMenuItem({
                    name: LanguageHelper.getNativeName(language),
                    selected: language === I18nController.shared.language,
                    action: async () => {
                        await I18nController.shared.switchToLocale({
                            language,
                        });

                        // Reload full page
                        window.location.reload();
                    },
                });
            }),
        ]);

        await menu.show({
            clickEvent: event,
        });
    }

    return {
        switchLanguage,
        hasLanguages: I18nController.shared ? (I18nController.shared.availableLanguages.length > 1) : false,
    };
}
