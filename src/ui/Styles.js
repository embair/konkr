import { extend } from 'lib/util';

function Styles() {
    
    const MAIN_FONT = "Bookman Old Style";
    const TOOLTIP_FONT = "Arial";

    const lib = {
        LARGE_BUTTON_TITLE: { font: `24pt ${MAIN_FONT}`, fill: "black"},
        LARGE_BUTTON_DESCRIPTION: { font: `10pt ${MAIN_FONT}`, fill: "black"},
        TREASURY_LABEL: {font: `20pt ${MAIN_FONT}`, fill: "black"},
        LABEL: { font: `12pt ${MAIN_FONT}`, fill: "black"},
        INCOME_LABEL: { font: `10pt ${MAIN_FONT}`, fill: "black"},
        TOOLTIP_TITLE: { font: `12pt ${TOOLTIP_FONT}`, fontWeight: "bold", fill: "black"},
        TOOLTIP_ATTRIBUTES: { font: `9pt ${TOOLTIP_FONT}`, fill: "black"},
        TOOLTIP_FLAVOUR_TEXT: { font: `9pt ${TOOLTIP_FONT}`,  fontStyle: "italic", fill: "#404040", wordWrap: true, wordWrapWidth:250},
        TOOLTIP_TEXT: { font: `9pt ${TOOLTIP_FONT}`, fill: "black", wordWrap: true, wordWrapWidth:250},
    };

    return Object.freeze({
        get
    });
    
    function get(styleName, decorations) {
        if (!lib[styleName]) throw new Error(`Style not found: ${styleName}`);
        let ret = Object.create(lib[styleName]);
        if (decorations) extend(ret, decorations);
        return ret;
    }
}

export default Styles;