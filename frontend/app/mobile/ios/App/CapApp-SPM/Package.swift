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
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.0"),
        .package(name: "CapacitorCommunityInAppReview", path: "../../../../../../node_modules/@capacitor-community/in-app-review"),
        .package(name: "CapacitorApp", path: "../../../../../../node_modules/@capacitor/app"),
        .package(name: "CapacitorAppLauncher", path: "../../../../../../node_modules/@capacitor/app-launcher"),
        .package(name: "CapacitorFilesystem", path: "../../../../../../node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorHaptics", path: "../../../../../../node_modules/@capacitor/haptics"),
        .package(name: "CapacitorKeyboard", path: "../../../../../../node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorPreferences", path: "../../../../../../node_modules/@capacitor/preferences"),
        .package(name: "CapacitorShare", path: "../../../../../../node_modules/@capacitor/share"),
        .package(name: "CapacitorStatusBar", path: "../../../../../../node_modules/@capacitor/status-bar"),
        .package(name: "CapgoCapacitorUpdater", path: "../../../../../../node_modules/@capgo/capacitor-updater")
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
