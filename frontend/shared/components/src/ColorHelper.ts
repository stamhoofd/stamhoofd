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

    static setColor(color: string) {
		this.primaryColor = color;
        document.documentElement.style.setProperty("--color-primary", color)

        // Do color manipulation here
        let { h, s, l } = hexToHSL(color.substring(1));
        // Modify s + l
        l = 97
		s = 100
		
		console.log(h)
        
        const primaryBackground = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--color-primary-background", primaryBackground)

        // Modify s + l
        l = 77
        s = 68
        const primaryGrayLight = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--color-primary-gray-light", primaryGrayLight)

		// Modify s + l
        l = 94
        s = 100
        const primaryLight = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--color-primary-light", primaryLight)

		// Modify s + l
        l = 98
        s = 100
        const primaryLighter = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--color-primary-lighter", primaryLighter)
    }

	static setupDarkTheme() {
		// Helper to set the dark theme colors
		const reference = 2;

		// Difference between background colors and white

		var { h, s, l } = hexToHSL(this.primaryColor?.substring(1) ?? "0053ff");
		l = 4 //reference
		s /= 4

		const preferredS = s / 6
		const preferredH = h
		document.documentElement.style.setProperty("--dark-theme-color-white", "hsl(" + h + "," + s + "%," + l + "%)");

		l = 0;
		document.documentElement.style.setProperty("--dark-theme-color-white-shade", "hsl(" + h + "," + s + "%," + l + "%)");

		// Do color manipulation here
		document.documentElement.style.setProperty("--dark-theme-color-dark", "white");

		// Do color manipulation here
        var { h, s, l } = hexToHSL("868686");
		l = Math.min(100 - l + reference, 100);
        const gray = "hsl(" + h + "," + s + "%," + l + "%)";
		//s = preferredS
		//h = preferredH
        document.documentElement.style.setProperty("--dark-theme-color-gray", gray)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("5E5E5E");
		l = Math.min(100 - l + reference, 100);
		//s = preferredS
		//h = preferredH
        const darkGray = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-gray-dark", darkGray)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("dcdcdc");
		l = Math.min(100 - l + reference, 100);
		//s = preferredS
		//h = preferredH
        const grayLight = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-gray-light", grayLight)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("e7e7e7");
		l = Math.min(100 - l + reference, 100);
		//s = preferredS
		//h = preferredH
        const grayLighter = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-gray-lighter", grayLighter)

		l += 12;
		s = 0;
		document.documentElement.style.setProperty("--dark-theme-color-white-highlight", "hsl(" + h + "," + s + "%," + l + "%)");


		// Do color manipulation here
        var { h, s, l } = hexToHSL("ffd6dd");
		l = Math.min(100 - l + reference, 100);
        const errorBackground = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-error-background", errorBackground)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("FFCAD3");
		l = Math.min(100 - l + reference, 100);
        const errorBorder = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-error-border", errorBorder)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("630012");
		l = Math.min(100 - l + reference, 100);
        const errorDark = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-error-dark", errorDark)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("fff6d6");
		l = Math.min(100 - l + reference + 6, 100);
        const warningBackground = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-warning-background", warningBackground)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("634e00");
		l = Math.min(100 - l + reference, 100);
        const warningDark = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-warning-dark", warningDark)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("E5F6EE");
		l = Math.min(100 - l + reference + 6, 100);
		s += 10
        const successBackground = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-success-background", successBackground)

		// Do color manipulation here
        var { h, s, l } = hexToHSL("0C4529");
		l = Math.min(100 - l + reference, 100);
        const successDark = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-success-dark", successDark)

		// Do color manipulation here
        var { h, s, l } = hexToHSL(this.primaryColor?.substring(1) ?? "0053ff");
        // Modify s + l
        l = 100 - 97 + reference + 6
		s = 100

        const primaryBackground = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-primary-background", primaryBackground)

        // Modify s + l
        l = 100 - 77 + reference
        s = 68
        const primaryGrayLight = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-primary-gray-light", primaryGrayLight)

		// Modify s + l
        l = 100 - 94 + reference
        s = 100
        const primaryLight = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-primary-light", primaryLight)

		// Modify s + l
        l = 100 - 98 + reference
        s = 100
        const primaryLighter = "hsl(" + h + "," + s + "%," + l + "%)";
        document.documentElement.style.setProperty("--dark-theme-color-primary-lighter", primaryLighter)
		

	}
}

(window as any).ColorHelper = ColorHelper;