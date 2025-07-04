import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, PatchMap } from '@simonbackx/simple-encoding';
import { Address, Parent, ParentType, PatchAnswers, RecordAddressAnswer, RecordAnswer, RecordDateAnswer, RecordSettings, RecordTextAnswer } from '@stamhoofd/structures';
import { ImportMemberResult } from './ExistingMemberResult';
import { MemberDetailsMatcherCategory } from './MemberDetailsMatcherCategory';

export class ColumnMatcherHelper {
    static patchRecordTextdAnswer(importResult: ImportMemberResult, value: string, settings: RecordSettings) {
        if (!value) {
            return;
        }

        this.patchRecordAnswers(settings, importResult, RecordTextAnswer.patch({
            value,
        }));
    }

    static patchRecordAddressAnswer(importResult: ImportMemberResult, address: Address | null, settings: RecordSettings) {
        if (!address) {
            return;
        }

        this.patchRecordAnswers(settings, importResult, RecordAddressAnswer.patch({
            address,
        }));
    }

    static patchRecordDateAnswer(importResult: ImportMemberResult, dateValue: Date | null, settings: RecordSettings) {
        if (!dateValue) {
            return;
        }

        this.patchRecordAnswers(settings, importResult, RecordDateAnswer.patch({
            dateValue,
        }));
    }

    private static patchRecordAnswers(settings: RecordSettings, importResult: ImportMemberResult, patch: AutoEncoderPatchType<RecordAnswer>) {
        const id = settings.id;
        const base = importResult.patchedDetails.recordAnswers.get(id) ?? RecordAnswer.createDefaultAnswer(settings);
        const patchMap = new PatchMap() as PatchAnswers;

        // PatchAnswer doesn't support pathces becase it is a generic type (needs type for decoding, which we don't support yet - See RecordAnswerDecoder)
        patchMap.set(id, base.patch(patch));

        importResult.addPatch({
            recordAnswers: patchMap,
        });
    }

    static patchAddress(importResult: ImportMemberResult, category: string, address: PartialWithoutMethods<AutoEncoderPatchType<Address>>) {
        switch (category) {
            case MemberDetailsMatcherCategory.Member as string: {
                const newAddress = Address.create({ ...(importResult.patchedDetails.address ?? {}), ...address });

                importResult.addPatch({
                    address: newAddress,
                });
                break;
            }
            case MemberDetailsMatcherCategory.Parent1 as string: {
                const newAddress = Address.create({ ...(importResult.patchedDetails.parents[0]?.address ?? {}), ...address });

                this.patchParent1(importResult, { address: newAddress });
                break;
            }
            case MemberDetailsMatcherCategory.Parent2 as string: {
                const newAddress = Address.create({ ...(importResult.patchedDetails.parents[1]?.address ?? {}), ...address });

                this.patchParent2(importResult, { address: newAddress });
                break;
            }
        }
    }

    static getAddress(importResult: ImportMemberResult, category: MemberDetailsMatcherCategory.Member | MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2) {
        switch (category) {
            case MemberDetailsMatcherCategory.Member: return this.getMemberAddress(importResult);
            case MemberDetailsMatcherCategory.Parent1: return this.getAndCreateParent1(importResult).address;
            case MemberDetailsMatcherCategory.Parent2: return this.getAndCreateParent2(importResult).address;
        }
    }

    private static getMemberAddress(importResult: ImportMemberResult) {
        return importResult.patchedDetails.address;
    }

    static patchParent(importResult: ImportMemberResult, category: MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2, parent: PartialWithoutMethods<AutoEncoderPatchType<Parent>>) {
        switch (category) {
            case MemberDetailsMatcherCategory.Parent1: {
                this.patchParent1(importResult, parent);
                break;
            }
            case MemberDetailsMatcherCategory.Parent2: {
                this.patchParent2(importResult, parent);
                break;
            }
        }
    }

    static patchParent1(importResult: ImportMemberResult, parent: PartialWithoutMethods<AutoEncoderPatchType<Parent>>) {
        const parent1 = this.getAndCreateParent1(importResult);
        const parents = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;

        parents.addPatch(Parent.patch({ id: parent1.id, ...parent }));

        importResult.addPatch({
            parents,
        });
    }

    static patchParent2(importResult: ImportMemberResult, parent: PartialWithoutMethods<AutoEncoderPatchType<Parent>>) {
        const parent2 = this.getAndCreateParent2(importResult);
        const parents = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;

        parents.addPatch(Parent.patch({ id: parent2.id, ...parent }));

        importResult.addPatch({
            parents,
        });
    }

    static getAndCreateParent1(importResult: ImportMemberResult): Parent {
        const parent = importResult.patchedDetails.parents[0];
        if (parent) {
            return parent;
        }
        else {
            const parents = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            parents.addPut(Parent.create({
                type: ParentType.Parent1,
            }));

            importResult.addPatch({
                parents,
            });

            return importResult.patchedDetails.parents[0]!;
        }
    }

    static getAndCreateParent2(importResult: ImportMemberResult): Parent {
        while (importResult.patchedDetails.parents.length < 2) {
            const parents = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            parents.addPut(Parent.create({
                type: ParentType.Parent2,
            }));

            importResult.addPatch({
                parents,
            });
        }

        return importResult.patchedDetails.parents[1]!;
    }
}
