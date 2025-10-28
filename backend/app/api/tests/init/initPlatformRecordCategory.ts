import { Platform } from '@stamhoofd/models';
import { RecordCategory } from '@stamhoofd/structures';

export async function initPlatformRecordCategory({ recordCategory }: { recordCategory: RecordCategory }): Promise<void> {
    const platform = await Platform.getForEditing();
    platform.config.recordsConfiguration.recordCategories.push(recordCategory);
    await platform.save();
}
