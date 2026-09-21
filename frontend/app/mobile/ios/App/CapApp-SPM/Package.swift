// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.1"),
        .package(name: "CapacitorCommunityInAppReview", path: "../../../../../../node_modules/.pnpm/@capacitor-community+in-app-review@8.0.0_@capacitor+core@8.5.1/node_modules/@capacitor-community/in-app-review"),
        .package(name: "CapacitorApp", path: "../../../../../../node_modules/.pnpm/@capacitor+app@8.1.1_@capacitor+core@8.5.1/node_modules/@capacitor/app"),
        .package(name: "CapacitorAppLauncher", path: "../../../../../../node_modules/.pnpm/@capacitor+app-launcher@8.0.1_@capacitor+core@8.5.1/node_modules/@capacitor/app-launcher"),
        .package(name: "CapacitorDevice", path: "../../../../../../node_modules/.pnpm/@capacitor+device@8.0.3_@capacitor+core@8.5.1/node_modules/@capacitor/device"),
        .package(name: "CapacitorFilesystem", path: "../../../../../../node_modules/.pnpm/@capacitor+filesystem@8.1.2_@capacitor+core@8.5.1/node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorHaptics", path: "../../../../../../node_modules/.pnpm/@capacitor+haptics@8.0.2_@capacitor+core@8.5.1/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorKeyboard", path: "../../../../../../node_modules/.pnpm/@capacitor+keyboard@8.0.5_@capacitor+core@8.5.1/node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorPreferences", path: "../../../../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.5.1/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorShare", path: "../../../../../../node_modules/.pnpm/@capacitor+share@8.0.1_@capacitor+core@8.5.1/node_modules/@capacitor/share"),
        .package(name: "CapacitorStatusBar", path: "../../../../../../node_modules/.pnpm/@capacitor+status-bar@8.0.3_@capacitor+core@8.5.1/node_modules/@capacitor/status-bar"),
        .package(name: "CapgoCapacitorUpdater", path: "../../../../../../node_modules/.pnpm/@capgo+capacitor-updater@8.51.2_@capacitor+core@8.5.1/node_modules/@capgo/capacitor-updater")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityInAppReview", package: "CapacitorCommunityInAppReview"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorAppLauncher", package: "CapacitorAppLauncher"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapgoCapacitorUpdater", package: "CapgoCapacitorUpdater")
            ]
        )
    ]
)
