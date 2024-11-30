import { Platform } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';
import { AuditLogType } from '@stamhoofd/structures';

export const PlatformLogger = new ModelLogger(Platform, {
    optionsGenerator: getDefaultGenerator({
        updated: AuditLogType.PlatformSettingsChanged,
    }),
});
