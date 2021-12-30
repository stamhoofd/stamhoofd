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

export class ColorHelper {
    static primaryColor: string | null;

    static setColor(color: string, element?: HTMLElement) {
        const { h, s } = hexToHSL(color.substring(1));
        element = element ?? document.documentElement
        element.style.setProperty("--color-primary-hue", h+"deg");
        element.style.setProperty("--color-primary-saturation", s+"%");

        this.primaryColor = color;
        element.style.setProperty("--color-primary", color)
    }
}

(window as any).ColorHelper = ColorHelper;