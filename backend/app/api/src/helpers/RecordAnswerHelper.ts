import type { AutoEncoderPatchType, Encodeable, Identifiable, Patchable, PatchableArray } from '@simonbackx/simple-encoding';
import { isPatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import type { RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';
import { RecordAnswerDecoder } from '@stamhoofd/structures';

export class RecordAnswerHelper {
    static throwIfPatchOrPutIsInvalid(original: RecordCategory[], patchOrPut: RecordCategory[] | PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>) {
        if (original.length === 0) {
            return;
        }
        
        const updatedRecordSettings = this.getAllRecords(patchOrPut)
            // only check if the types changed
            .filter(p => p.type !== undefined || p.fileType !== undefined);

        if (updatedRecordSettings.length === 0) {
            return;
        }

        const updatRecordSettingsMap = new Map<string, RecordSettings | AutoEncoderPatchType<RecordSettings>>(updatedRecordSettings.map(p => [p.id, p]));

        for (const category of original) {
            for (const originalRecord of category.getAllRecords()) {
                const updatedSettings = updatRecordSettingsMap.get(originalRecord.id);
                if (updatedSettings) {
                    this.throwIfInvalidRecordSettingsUpdate(originalRecord, updatedSettings);

                    // remove from map
                    updatRecordSettingsMap.delete(originalRecord.id);

                    // stop looping if all updated records are checked
                    if (updatRecordSettingsMap.size === 0) {
                        break;
                    }
                }
            }
        }
    }

    static throwIfPatchOrPutsAreInvalid<
        Key extends string & keyof Put,
        Id extends string | number,
        Put extends (Identifiable<Id> & Encodeable & Patchable<Patch> & Record<Key, RecordCategory[]>),
        Patch extends (Identifiable<Id> & Encodeable) | Put
    >(originals: Put[], patchOrPuts: Put[] | Patch[] | PatchableArray<Id, Put, Patch>, key: string) {
        if (isPatchableArray(patchOrPuts)) {
            const puts = patchOrPuts.getPuts().map(p => p.put);
            this.throwIfPatchOrPutsAreInvalid<Key, Id, Put, Patch>(originals, puts, key);
            const patches = patchOrPuts.getPatches();
            this.throwIfPatchOrPutsAreInvalid<Key, Id, Put, Patch>(originals, patches, key);
        } else {
            for (const patchOrPut of patchOrPuts) {
                const original = originals.find(o => o.id === patchOrPut.id);
                if (original) {
                    const originalRecordCategories: RecordCategory[] = original[key];
                    const newRecordCategories: RecordCategory[] | PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>> = patchOrPut[key];
                    if (originalRecordCategories && newRecordCategories) {
                        this.throwIfPatchOrPutIsInvalid(originalRecordCategories, newRecordCategories);
                    }
                }
            }
        }
    }

    private static throwIfInvalidRecordSettingsUpdate(original: RecordSettings, updated: RecordSettings | AutoEncoderPatchType<RecordSettings>) {
        if (updated.type !== undefined
            && original.type !== updated.type
            // changing between types with the same class should be allowed
            && !this.haveTypesSameClass(original.type, updated.type)) {
            throw new SimpleError({
                code: 'invalid_record_type',
                message: `Cannot change record type from ${original.type} to ${updated.type}`,
                human: $t(`Je kan het type van de bestaande vraag '{name}' niet wijzigen.`, {name: original.name}),
            })
        }

        if (updated.fileType !== undefined && ((original.fileType ?? null) !== (updated.fileType ?? null))) {
            throw new SimpleError({
                code: 'invalid_record_type',
                message: `Cannot change record file type from ${original.fileType} to ${updated.fileType}`,
                human: $t(`Je kan het bestandstype van de bestaande vraag '{name}' niet wijzigen.`, {name: original.name}),
            })
        }
    }

    static haveTypesSameClass(a: RecordType, b: RecordType) {
        return RecordAnswerDecoder.getClassForType(a) === RecordAnswerDecoder.getClassForType(b);
    }

    private static getAllRecords(patchOrPut: RecordCategory[] | PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>): (RecordSettings | AutoEncoderPatchType<RecordSettings>)[] {
        if (isPatchableArray(patchOrPut)) {
            const patches = patchOrPut.getPatches().flatMap(p => this.getAllRecordsFromRecordCategoryPatch(p));
            const puts = patchOrPut.getPuts().flatMap(p => p.put.getAllRecords());
            return [...patches, ...puts];
        }
        return patchOrPut.flatMap(c => c.getAllRecords());
    }

    private static getAllRecordsFromRecordCategoryPatch(category: AutoEncoderPatchType<RecordCategory>) {
        const results: (RecordSettings | AutoEncoderPatchType<RecordSettings>)[] = [
            ...category.records.getPatches(),
            ...category.records.getPuts().map(p => p.put)
        ];

        if (category.childCategories) {
            const childCategoryPatches = category.childCategories.getPatches().flatMap(p => this.getAllRecordsFromRecordCategoryPatch(p));
            results.push(...childCategoryPatches);

            const childCategoryPuts = category.childCategories.getPuts().flatMap(p => p.put.getAllRecords());
            results.push(...childCategoryPuts);
        }

        return results;
    }
}
