module.exports = {
    preset: 'ts-jest',
    roots: ['<rootDir>'],
    testEnvironment: 'node',
    moduleDirectories: [
        'node_modules',
    ],
    modulePathIgnorePatterns: ['dist'],
    // verbose: true,
};
