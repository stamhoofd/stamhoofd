function hexToHSL(hex) {
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
    static setColor(color: string) {
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
    }
}