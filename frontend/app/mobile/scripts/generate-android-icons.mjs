#!/usr/bin/env node

/**
 * Runs after `@capacitor/assets generate` and reads the same --assetPath, so every
 * whitelabel keeps its icons in one place.
 *
 * It fixes two things @capacitor/assets does not:
 *
 * 1. The adaptive launcher icon layers. @capacitor/assets 3.0.5 generates
 *    ic_launcher_foreground/background at the legacy launcher sizes (36-192px) instead
 *    of its own adaptive sizes (81-432px), so the launcher icon is upscaled ~1.5x.
 * 2. The Android 12+ splash icon. Without windowSplashScreenAnimatedIcon the system
 *    blows the launcher icon up to a 192dp circle (a further ~2.2x), so this writes a
 *    dedicated ic_splash_icon at splash resolution.
 */

import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RES_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../android/app/src/main/res');

/** Sizes @capacitor/assets defines as ANDROID_*_ADAPTIVE_ICON but never uses. */
const ADAPTIVE_ICON_SIZES = {
    ldpi: 81,
    mdpi: 108,
    hdpi: 162,
    xhdpi: 216,
    xxhdpi: 324,
    xxxhdpi: 432,
};

const DENSITY_SCALES = {
    ldpi: 0.75,
    mdpi: 1,
    hdpi: 1.5,
    xhdpi: 2,
    xxhdpi: 3,
    xxxhdpi: 4,
};

/**
 * Android draws windowSplashScreenAnimatedIcon in a 288dp box and expects the artwork
 * inside a 192dp circle when no windowSplashScreenIconBackgroundColor is set.
 * The circle is baked into the PNG so the result does not depend on the OEM icon mask.
 */
const SPLASH_ICON_DP = 288;
const SPLASH_CIRCLE_DP = 192;

const SOURCE_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg'];

function parseAssetPath() {
    const index = process.argv.indexOf('--assetPath');
    const value = index === -1 ? 'assets' : process.argv[index + 1];

    if (!value) {
        throw new Error('--assetPath requires a value');
    }

    return resolve(process.cwd(), value);
}

function findSource(assetPath, name) {
    for (const extension of SOURCE_EXTENSIONS) {
        const path = join(assetPath, `${name}.${extension}`);
        if (existsSync(path)) {
            return path;
        }
    }

    throw new Error(`Missing ${name}.(${SOURCE_EXTENSIONS.join('|')}) in ${assetPath}`);
}

async function warnIfTooSmall(source, required) {
    const metadata = await sharp(source).metadata();
    if (metadata.format === 'svg') {
        return;
    }

    const size = Math.min(metadata.width ?? 0, metadata.height ?? 0);
    if (size < required) {
        console.warn(`⚠ ${source} is ${size}px but ${required}px is needed for xxxhdpi. Use an SVG or a larger source.`);
    }
}

async function write(relativePath, buffer) {
    const destination = join(RES_PATH, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
}

async function generateAdaptiveIconLayers(foreground, background) {
    for (const [density, size] of Object.entries(ADAPTIVE_ICON_SIZES)) {
        await write(
            `mipmap-${density}/ic_launcher_foreground.png`,
            await sharp(foreground).resize(size, size).png().toBuffer(),
        );
        await write(
            `mipmap-${density}/ic_launcher_background.png`,
            await sharp(background).resize(size, size).png().toBuffer(),
        );
    }
}

async function generateSplashIcon(foreground, background) {
    for (const [density, scale] of Object.entries(DENSITY_SCALES)) {
        const canvas = Math.round(SPLASH_ICON_DP * scale);
        const circle = Math.round(SPLASH_CIRCLE_DP * scale);

        const mask = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${circle}" height="${circle}">`
            + `<circle cx="${circle / 2}" cy="${circle / 2}" r="${circle / 2}" fill="#fff"/></svg>`,
        );

        const masked = await sharp(await sharp(background).resize(circle, circle).ensureAlpha().png().toBuffer())
            .composite([
                { input: await sharp(foreground).resize(circle, circle).png().toBuffer() },
                { input: mask, blend: 'dest-in' },
            ])
            .png()
            .toBuffer();

        const icon = await sharp({
            create: {
                width: canvas,
                height: canvas,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        })
            .composite([{ input: masked, gravity: 'center' }])
            .png()
            .toBuffer();

        await write(`drawable-${density}/ic_splash_icon.png`, icon);
    }
}

const assetPath = parseAssetPath();
const foreground = findSource(assetPath, 'icon-foreground');
const background = findSource(assetPath, 'icon-background');

await warnIfTooSmall(foreground, SPLASH_CIRCLE_DP * DENSITY_SCALES.xxxhdpi);
await warnIfTooSmall(background, SPLASH_CIRCLE_DP * DENSITY_SCALES.xxxhdpi);

await generateAdaptiveIconLayers(foreground, background);
await generateSplashIcon(foreground, background);

console.log(`✔ Generated Android adaptive icon layers and splash icon from ${assetPath}`);
