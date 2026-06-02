// CI and production installs skip devDependencies, so the husky binary is not available there.
if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') {
    process.exit(0);
}

const husky = (await import('husky')).default;

console.log(husky());
