import { AutoEncoderPatchType, PartialWithoutMethods, PatchMap, patchObject } from '@simonbackx/simple-encoding';
import { Address, Parent, ParentType, RecordAnswer } from '@stamhoofd/structures';
import { ImportMemberResult } from './ExistingMemberResult';
import { MemberDetailsMatcherCategory } from './MemberDetailsMatcherCategory';

export class ColumnMatcherHelper {
    static patchRecordAnswers(importResult: ImportMemberResult, recordAnswer: RecordAnswer) {
        const patchMap = importResult.getPatch().recordAnswers;
        patchObject(patchMap, new PatchMap([[recordAnswer.id, recordAnswer]]));
        importResult.addPatch({
            recordAnswers: patchMap,
        });
    }

    static patchAddress(importResult: ImportMemberResult, category: string, address: PartialWithoutMethods<AutoEncoderPatchType<Address>>) {
        const addressPatch = Address.patch(address);

        switch (category) {
            case MemberDetailsMatcherCategory.Member as string: {
                importResult.addPatch({
                    address: addressPatch,
                });
                break;
            }
            case MemberDetailsMatcherCategory.Parent1 as string: {
                this.patchParent1(importResult, { address: addressPatch });
                break;
            }
            case MemberDetailsMatcherCategory.Parent2 as string: {
                this.patchParent2(importResult, { address: addressPatch });
                break;
            }
        }
    }

    static getAddress(importResult: ImportMemberResult, category: MemberDetailsMatcherCategory.Member | MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2) {
        switch (category) {
            case MemberDetailsMatcherCategory.Member: return this.getMemberAddress(importResult);
            case MemberDetailsMatcherCategory.Parent1: return this.getParent1(importResult).address;
            case MemberDetailsMatcherCategory.Parent2: return this.getParent2(importResult).address;
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
        const parents = importResult.getPatch().parents;
        const parent1 = this.getParent1(importResult);

        parents.addPatch(Parent.patch({ id: parent1.id, ...parent }));

        importResult.addPatch({
            parents,
        });
    }

    static patchParent2(importResult: ImportMemberResult, parent: PartialWithoutMethods<AutoEncoderPatchType<Parent>>) {
        const parents = importResult.getPatch().parents;
        const parent2 = this.getParent2(importResult);

        parents.addPatch(Parent.patch({ id: parent2.id, ...parent }));

        importResult.addPatch({
            parents,
        });
    }

    static getParent1(importResult: ImportMemberResult): Parent {
        const parent = importResult.patchedDetails.parents[0];
        if (parent) {
            return parent;
        }
        else {
            const parents = importResult.getPatch().parents;
            parents.addPut(Parent.create({
                type: ParentType.Parent1,
            }));

            importResult.addPatch({
                parents,
            });

            return importResult.patchedDetails.parents[0]!;
        }
    }

    static getParent2(importResult: ImportMemberResult): Parent {
        while (importResult.patchedDetails.parents.length < 2) {
            const parents = importResult.getPatch().parents;
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
