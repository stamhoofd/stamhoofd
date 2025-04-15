import { getTextType, TextType } from "./get-text-type";

const blackLists = new Map<TextType, Set<string>>([
    [TextType.Key, new Set(['icon', 'method', 'path', 'modalDisplayStyle', 'id', 'Id', 'service', 'type', 'Type', 'Connection', 'Keys', 'keys', 'environment', 'sign', 'sort', 'direction', 'field', 'code', 'key', 'token', 'mode', 'url', 'server', 'status', 'locale', 'algorithm'])],
    [TextType.FunctionArgument, new Set(['$t', 'process.on', 'console.error', 'console.log', 'console.info', 'console.warn', 'import', 'resolve', 'where', 'whereNot', 'Migration.runAll', 'AuditLogReplacement.key', 'loadAllEndpoints', '.set', '.includes', ' if', 'registerCron', '.column', 'require', 'setZone', 'startsWith', 'parseParameters', 'isRunning','SQLAlias', 'schedule', '.or', '.from', '.wildcard', '.table', 'fromRows', 'andWhere', 'QueueHandler.debounce', '.checkDuplicate'])],
    [TextType.Variable, new Set(['process.env.TZ', 'Keys', 'keys', 'id', 'Id', 'uploadExt', 'mode', 'url', 'server', 'status', 'locale', 'algorithm'])]
]);

const keyCombinationBlacklist = new Map<TextType, Map<string, Set<string>>>([
[TextType.FunctionArgument, new Map([
    ['new SimpleError', new Set(['message'])]
])],
[TextType.Variable, new Map([
    ['errBody', new Set(['message'])]
])]
])

export function shouldTranslateTypescriptString(allParts: {value: string}[] | string): boolean {
    return shouldTranslateTypescriptStringHelper(allParts);
}

function shouldTranslateTypescriptStringHelper(allParts: {value: string}[] | string, initialKeyName?: string): boolean {
    const textType = getTextType(allParts);

    if(textType) {
        const {type, name} = textType;

        if(name === null) {
            return false;
        }

        if(initialKeyName) {
            if(type === TextType.Key) {
                return shouldTranslateTypescriptStringHelper(name, initialKeyName);
            }

            const blackList = keyCombinationBlacklist.get(type);
            if(blackList) {
                for(const [key, value] of blackList.entries()) {
                    if(name.endsWith(key)) {
                        for(const item of value.values()) {
                            if(initialKeyName.endsWith(item)) {
                                return false;
                            }
                        }
                    }
                }
            }
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

        if(type === TextType.Key) {
            // todo: find beginning?

            return shouldTranslateTypescriptStringHelper(name, name.trimEnd());
        }
    }

    return true;
}
