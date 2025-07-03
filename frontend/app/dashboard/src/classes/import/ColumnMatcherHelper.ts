import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, PatchMap } from '@simonbackx/simple-encoding';
import { Address, Parent, ParentType, RecordAnswer } from '@stamhoofd/structures';
import { ImportMemberResult } from './ExistingMemberResult';
import { MemberDetailsMatcherCategory } from './MemberDetailsMatcherCategory';

export class ColumnMatcherHelper {
    static patchRecordAnswers(importResult: ImportMemberResult, recordAnswer: RecordAnswer) {
        importResult.addPatch({
            recordAnswers: new PatchMap([[recordAnswer.id, recordAnswer]]),
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
