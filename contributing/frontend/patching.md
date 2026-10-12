# Patching inside views

**Work in progress.** The editing-pattern guide is still TODO; this documents the available hook example, not a complete edit-view pattern.

Keep the original structure separate from accumulated edits. Bind inputs to computed properties that read the patched copy and add patches in their setters:

```ts
import { usePatch } from '@stamhoofd/components/hooks/usePatch';
import type { Organization } from '@stamhoofd/structures';
import { computed, toRef } from 'vue';

const props = defineProps<{ organization: Organization }>();
const { patched, hasChanges, addPatch, patch, reset } = usePatch(toRef(props, 'organization'));

const name = computed({
    get: () => patched.value.name,
    set: (value: string) => addPatch({ name: value }),
});
```

`toRef` lets the hook follow replacement of the prop; passing `props.organization` captures that object instead. A getter is not supported. Existing edits survive source replacement, so reset/recreate editing state when switching to another record. Save the accumulated `patch.value`; reset only after successful persistence and updating the source.

## Composing hooks

Use [usePatchArray](../../frontend/shared/components/src/hooks/usePatchArray.ts) or [usePatchMap](../../frontend/shared/components/src/hooks/usePatchMap.ts) for local collection edits. Their `hasChanges` checks for queued operations, unlike `usePatch`'s comparison against the original object.

For a child that forwards edits, use [useEmitPatch](../../frontend/shared/components/src/hooks/useEmitPatch.ts): its `patched` ref reads the prop, and the parent must handle `patch:<propName>` events. [usePatchableArray](../../frontend/shared/components/src/hooks/usePatchableArray.ts) forwards individual operations to an array-patch callback instead of owning local state.

See the [usePatch contract](../../frontend/shared/components/src/hooks/usePatch.ts) and the [encoding library's patching guide](https://github.com/SimonBackx/simple-encoding/blob/master/docs/patching.md) for composition details.
