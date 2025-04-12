import { getTextType, TextType } from "./get-text-type";

const blackLists = new Map<TextType, Set<string>>([
    [TextType.Key, new Set(['icon', 'method', 'path', 'modalDisplayStyle', 'id', 'Id', 'service', 'type', 'Type', 'Connection', 'Keys', 'keys', 'environment', 'sign', 'sort', 'direction', 'field', 'code', 'key', 'token'])],
    [TextType.FunctionArgument, new Set(['process.on', 'console.error', 'console.log', 'console.info', 'console.warn', 'import', 'resolve', 'where', 'whereNot', 'Migration.runAll', 'AuditLogReplacement.key', 'loadAllEndpoints', '.set', '.includes', ' if', 'registerCron', '.column', 'require', 'setZone', 'startsWith', 'parseParameters', 'isRunning','SQLAlias', 'schedule', '.or', '.from', '.wildcard', '.table', 'fromRows'])],
    [TextType.Variable, new Set(['process.env.TZ', 'Keys', 'keys', 'id', 'Id', 'uploadExt'])]
])

export function shouldTranslateTypescriptString(allParts: {value: string, shouldTranslate: boolean}[], value: string): boolean {
    const textType = getTextType(allParts);

    if(textType) {
        const {type, name} = textType;
        if(name === null) {
            return false;
        }

        const blackList = blackLists.get(type);
        if(blackList) {
            const trimmedName = name.trimEnd();
            for(const item of blackList) {
                if(trimmedName.endsWith(item)) {
                    return false;
                }
            }
        }
    }

    return true;
}
