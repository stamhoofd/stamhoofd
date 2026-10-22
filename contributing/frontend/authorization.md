# Permission checking in the frontend (authorization)

The `ContextPermissions` class handles permission checking in the frontend. You can easily access it via the session context or the `useAuth` hook:

```typescript
const auth = useAuth();

const hasPermissions = auth.canAccessPlatformMember(member);
```

Is shorthand for:

```typescript
const context = useContext();

const hasPermissions = computed(() => {
		return context.value.auth.canAccessPlatformMember(member);
});
```

You can check out the full API `frontend/shared/networking/src/ContextPermissions.ts`
