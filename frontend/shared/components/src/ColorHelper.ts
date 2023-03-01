import { DarkMode } from "@stamhoofd/structures";

type RGB = {
    r: number;
    g: number;
    b: number;
}

/* eslint-disable no-var */
function hexToHSL(hex) {
  	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if(max == min){
        h = s = 0; // achromatic
    }else{
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return {
        h: h * 360, s: s * 100, l: l * 100
    };
}

function HSLToRGB(h,s,l) {
    // Must be fractions of 1
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c/2
    
    let r = 0,
        g = 0,
        b = 0;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;  
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return {
        r, g, b
    }
}

function hexToRGB(hex) {
    if(hex.length != 6){
        throw "Only six-digit hex colors are allowed.";
    }

    const aRgbHex = hex.match(/.{1,2}/g);
    return {
        r: parseInt(aRgbHex[0] as string, 16),
        g: parseInt(aRgbHex[1] as string, 16),
        b: parseInt(aRgbHex[2] as string, 16)
    };
}

function getContrastRatio(foreground: RGB, background: RGB) {
    const L1 = getRelativeLuminance(background)
    const L2 = getRelativeLuminance(foreground)

    // https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

function getRelativeLuminance(c: RGB) {
    const color = {
        r: c.r / 255,
        g: c.g / 255,
        b: c.b / 255
    };

    // https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
    const R =
    color.r <= 0.03928
        ? color.r / 12.92
        : Math.pow((color.r + 0.055) / 1.055, 2.4)
    const G =
    color.g <= 0.03928
        ? color.g / 12.92
        : Math.pow((color.g + 0.055) / 1.055, 2.4)
    const B =
    color.b <= 0.03928
        ? color.b / 12.92
        : Math.pow((color.b + 0.055) / 1.055, 2.4)

    const L = 0.2126 * R + 0.7152 * G + 0.0722 * B

    return L
}

function getContrastColor(rgb: RGB) {
    const blackContrast = getAPCAContrast(rgb, {r: 0, g: 0, b: 0});
    const whiteContrast = getAPCAContrast(rgb, {r: 255, g: 255, b: 255});

    return blackContrast > whiteContrast ? "#000" : "#fff";
}

// https://github.com/Myndex/SAPC-APCA#the-plain-english-steps-are

// Example:
// const contrast = getAPCAContrast("rgb(255, 255, 255)", "rgb(136, 136, 136)");
// This returns `66.89346308821438` (66.893%)
// SAPC-APCA README says:
// > #888 vs #fff •  66.89346308821438
// 80% means 7:1 in WCAG 2.0
// 60% means 4.5:1 in WCAG 2.0

// Web UI: https://hail2u.net/pub/test/702.html

const linearize = (val) => (val / 255.0) ** 2.4;

const clampLuminance = (luminance) => {
    const blkThrs = 0.022;
    const blkClmp = 1.414;

    if (luminance > blkThrs) {
        return luminance;
    }

    return Math.abs(blkThrs - luminance) ** blkClmp + luminance;
};

const getLuminance = (color: RGB) => {
    const y =
		0.2126729 * linearize(color.r) +
		0.7151522 * linearize(color.g) +
		0.072175 * linearize(color.b);
    return clampLuminance(y);
};

const getContrast = (background: RGB, foreground: RGB) => {
    const deltaYmin = 0.0005;
    const scale = 1.14;

    const backgroundLuminance = getLuminance(background);
    const foregroundLuminance = getLuminance(foreground);

    if (Math.abs(backgroundLuminance - foregroundLuminance) < deltaYmin) {
        return 0.0;
    }

    if (backgroundLuminance > foregroundLuminance) {
        return (backgroundLuminance ** 0.56 - foregroundLuminance ** 0.57) * scale;
    }

    if (backgroundLuminance < foregroundLuminance) {
        return (backgroundLuminance ** 0.65  - foregroundLuminance ** 0.62) * scale;
    }

    return 0.0;
};

const scaleContrast = (contrast: number) => {
    const loClip = 0.001;
    const loConThresh = 0.035991;
    const loConFactor = 27.7847239587675;
    const loConOffset = 0.027;

    const absContrast = Math.abs(contrast);

    if (absContrast < loClip) {
        return 0.0;
    }

    if (absContrast <= loConThresh) {
        return contrast - contrast * loConFactor * loConOffset;
    }

    if (contrast > loConThresh) {
        return contrast - loConOffset;
    }

    if (contrast < -loConThresh) {
        return contrast + loConOffset;
    }

    return 0.0;
};

const getAPCAContrast = (background: RGB, foreground: RGB) => {
    const contrast = getContrast(background, foreground);
    const scaledContrast = scaleContrast(contrast);
    return Math.abs(scaledContrast * 100);
};


export class ColorHelper {
    static primaryColor: string | null;
    static hue;
    static saturation;

    static setColor(color: string, element?: HTMLElement) {
        const { h, s, l } = hexToHSL(color.substring(1));
        const rgb = hexToRGB(color.substring(1));

        element = element ?? document.documentElement
        element.style.setProperty("--color-primary-hue", h+"deg");
        element.style.setProperty("--color-primary-saturation", s+"%");
        element.style.setProperty("--color-saturation-factor", (s / 100).toFixed(2));

        this.primaryColor = color;
        this.hue = h;
        this.saturation = s;

        // Calculate contrast color
        const contrastColor = getContrastColor(rgb);

        element.style.setProperty("--color-primary-contrast", contrastColor);
        element.style.setProperty("--dark-theme-color-primary-contrast", contrastColor);

        element.style.setProperty("--color-primary", color);
        element.style.setProperty("--dark-theme-color-primary", color);

        // Invert dark or light colors depending on theme
        const blackContrast = getAPCAContrast(rgb, {r: 0, g: 0, b: 0});
        const whiteContrast = getAPCAContrast(rgb, {r: 255, g: 255, b: 255});
        if (blackContrast < 50) {
            const newL = 100 - l;
            const newRGB = HSLToRGB(h, s, newL);
            const newBlackContrast = getContrastRatio(newRGB, {r: 0, g: 0, b: 0});

            if (newBlackContrast > blackContrast) {
                element.style.setProperty("--dark-theme-color-primary", `hsl(${h}, ${s}%, ${newL}%)`);

                // Revert contrast color
                element.style.setProperty("--dark-theme-color-primary-contrast", getContrastColor(newRGB));
            }
        }

        if (whiteContrast < 50) {
            const newL = 100 - l;
            const newRGB = HSLToRGB(h, s, newL);
            const newWhiteContrast = getContrastRatio(newRGB, {r: 255, g: 255, b: 255});

            if (newWhiteContrast > whiteContrast) {
                element.style.setProperty("--color-primary", `hsl(${h}, ${s}%, ${newL}%)`);

                // Invert contrast color
                element.style.setProperty("--color-primary-contrast", getContrastColor(newRGB));
            }
        }
    }

    static setDarkMode(darkMode: DarkMode) {
        if (darkMode === DarkMode.On) {
            document.body.classList.add("dark");
        } else if (darkMode === DarkMode.Off) {
            document.body.classList.add("light");
        }
    }
}

(window as any).ColorHelper = ColorHelper;