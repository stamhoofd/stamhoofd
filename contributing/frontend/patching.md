# Patching inside views

**usePatch**

A helper hook that creates a new ‘patch’ of an encodeable/patchable object.

```typescript
const props = defineProps<{
    organization: Organization;
}>();

const { patched, hasChanges, addPatch, patch } = usePatch(props.organization);

const name = computed({
    get: () => patched.value.name,
    set: (value) => {
        addPatch({ name: value });
    },
});
```

## Full pattern

[UI: Edit views](../patterns/edit-views.md)
