import { Platform } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
import { AuditLogType } from '@stamhoofd/structures';

export const PlatformLogger = new ModelLogger(Platform, {
    skipKeys: ['serverConfig'],
    optionsGenerator: getDefaultGenerator({
        updated: AuditLogType.PlatformSettingsChanged,
    }),

    postProcess(event, options, log) {
        log.organizationId = null;
    },
});
