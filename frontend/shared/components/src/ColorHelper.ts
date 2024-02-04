import { DarkMode } from "@stamhoofd/structures";
import { Colors } from "@stamhoofd/utility";

export class ColorHelper {
    static primaryColor: string | null;
    static hue;
    static saturation;

    static setColor(color: string, element?: HTMLElement) {
        const { h, s, l } = Colors.hexToHSL(color);
        const rgb = Colors.hexToRGB(color);

        element = element ?? document.documentElement
        element.style.setProperty("--color-primary-hue", h+"deg");
        element.style.setProperty("--color-primary-saturation", s+"%");
        element.style.setProperty("--color-saturation-factor", (s / 100).toFixed(2));

        this.primaryColor = color;
        this.hue = h;
        this.saturation = s;

        // Calculate contrast color
        const contrastColor = Colors.getContrastColor(rgb);

        element.style.setProperty("--color-primary-contrast", contrastColor);
        element.style.setProperty("--dark-theme-color-primary-contrast", contrastColor);

        element.style.setProperty("--color-primary", color);
        element.style.setProperty("--dark-theme-color-primary", color);

        // Invert dark or light colors depending on theme
        const blackContrast = Colors.getAPCAContrast(rgb, {r: 0, g: 0, b: 0});
        const whiteContrast = Colors.getAPCAContrast(rgb, {r: 255, g: 255, b: 255});
        if (blackContrast < 50) {
            const newL = 100 - l;
            const newRGB = Colors.HSLToRGB(h, s, newL);
            const newBlackContrast = Colors.getContrastRatio(newRGB, {r: 0, g: 0, b: 0});

            if (newBlackContrast > blackContrast) {
                element.style.setProperty("--dark-theme-color-primary", `hsl(${h}, ${s}%, ${newL}%)`);

                // Revert contrast color
                element.style.setProperty("--dark-theme-color-primary-contrast", Colors.getContrastColor(newRGB));
            }
        }

        if (whiteContrast < 50) {
            const newL = 100 - l;
            const newRGB = Colors.HSLToRGB(h, s, newL);
            const newWhiteContrast = Colors.getContrastRatio(newRGB, {r: 255, g: 255, b: 255});

            if (newWhiteContrast > whiteContrast) {
                element.style.setProperty("--color-primary", `hsl(${h}, ${s}%, ${newL}%)`);

                // Invert contrast color
                element.style.setProperty("--color-primary-contrast", Colors.getContrastColor(newRGB));
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