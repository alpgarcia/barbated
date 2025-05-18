import React, { useEffect, useRef } from 'react'; // Added useEffect, useRef
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode'; // Import JsBarcode
import { jsPDF } from 'jspdf'; // Importación para PDF
import { ParsedBarcodeData, DigitMappingDetail } from '../lib/barcode-parser';
import antonScFontDataUrl from '../assets/fonts/Anton_SC/AntonSC-Regular.ttf?inline'; // Importación para la fuente

const UI_SCALE_FACTOR = 3; // Define at component/module level

interface ParsedDataDisplayProps {
  data: ParsedBarcodeData;
  showExplanations: boolean;
  setHighlightedDigits: (indices: number[] | null) => void;
}

// Helper to flatten the data object for display
const flattenData = (data: ParsedBarcodeData): Record<string, string | number | boolean | undefined | Record<string, any>> => {
  const flat: Record<string, string | number | boolean | undefined | Record<string, any>> = {};

  // Flatten top-level properties, excluding 'stats' and context objects
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'stats' && !key.endsWith('Context') && key !== 'digitMappings') {
      flat[key] = value;
    }
  }

  // Flatten stats if they exist
  if (data.stats) {
    for (const [statKey, statValue] of Object.entries(data.stats)) {
      if (typeof statValue === 'string' || typeof statValue === 'number' || typeof statValue === 'boolean') {
        flat[`stats.${statKey}`] = statValue;
      } else {
        flat[`stats.${statKey}`] = String(statValue);
      }
    }
  }

  // Reorder
  const orderedFlat: Record<string, string | number | boolean | undefined | Record<string, any>> = {};
  const preferredOrder = [
    'barcode', 'barcodeType', 'isValid', 'errorKey', 'methodUsed', 'reasonKey', // Added barcodeType
    'cardType', 'powerUpType', 'stats.hp', 'stats.st', 'stats.df', 'stats.dx', 'stats.pp', 'stats.mp',
    'race', 'occupation', 'flag', 'isHero', 'isSingleUse',
  ];
  preferredOrder.forEach(key => {
    if (key in flat) {
      orderedFlat[key] = flat[key];
    }
  });
  for (const key in flat) {
    if (!orderedFlat.hasOwnProperty(key)) {
      orderedFlat[key] = flat[key];
    }
  }

  return orderedFlat;
};

const ParsedDataDisplay: React.FC<ParsedDataDisplayProps> = ({ data, showExplanations, setHighlightedDigits }) => {
  const { t } = useTranslation();
  const barcodeUiCardBackRef = useRef<SVGSVGElement>(null); // Renamed for clarity
  const barcodeUiCardFrontRef = useRef<SVGSVGElement>(null); // New ref for the front

  const flatData = flattenData(data);

  // Memoize generateCardSvgContent to stabilize its identity if its dependencies are stable
  // This assumes UI_SCALE_FACTOR, capHeightRatio etc. are stable (module constants or similar)
  // and `t` from useTranslation is stable.
  const generateCardSvgContent = React.useCallback((
    barcodeValue: string,
    barcodeFormat: "EAN8" | "EAN13",
    cardSide: 'front' | 'back'
  ): string => {
    // Base MM dimensions (used for calculating scaled pixel values)
    const cardWidthMM = 86; // Standard card width
    const cardHeightMM = 59; // Needed for barcode Y position calculation
    const barcodeOnCardWidthMM = 40;
    const barcodeOnCardHeightMM = 12;
    const barcodePaddingLeftMM = 22;
    const cardCornerRadiusMM = 2;

    // Dimensions in scaled pixels for internal rendering
    const fullCardWidthPx = cardWidthMM * UI_SCALE_FACTOR;
    const fullCardHeightPx = cardHeightMM * UI_SCALE_FACTOR; 
    const barcodeOnCardWidthPx = barcodeOnCardWidthMM * UI_SCALE_FACTOR;
    const barcodeOnCardHeightPx = barcodeOnCardHeightMM * UI_SCALE_FACTOR;
    const barcodePaddingLeftPx = barcodePaddingLeftMM * UI_SCALE_FACTOR;
    const cardCornerRadiusPx = cardCornerRadiusMM * UI_SCALE_FACTOR;

    // Calculate barcode position based on the full card height in scaled pixels
    const barcodeXUnrotatedPx = barcodePaddingLeftPx;
    const barcodeYUnrotatedPx = fullCardHeightPx - barcodeOnCardHeightPx;

    // --- Add separator lines ---
    let separatorLinesSvg = '';
    const lineInsetPx = 3 * UI_SCALE_FACTOR; // Small inset for lines from card edges
    const lineStrokeColor = "#000000"; // Changed to black
    const lineStrokeWidth = "0.75px"; // Thin lines

    const currentCardType = data.cardType; // Access cardType from component props

    const lineX1 = lineInsetPx;
    const lineX2 = fullCardWidthPx - lineInsetPx;

    let titleTextSvg = '';
    const titleFontSizePx = 5 * UI_SCALE_FACTOR; // Font size for the title
    const largeBFontSizePx = titleFontSizePx * 1.5; // Font size for the 'B's
    const spaceAdjustmentDx = 0.5 * UI_SCALE_FACTOR; // Adjust this value to control the space

    // Estimate cap height ratio for Anton SC (all caps font). This may need tuning.
    const capHeightRatio = 0.82;

    const escapeXml = (unsafe: string): string => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
        }
        return c;
      });
    };

    // Use alphabetic baseline for more consistent rendering across SVG viewers.

    if (cardSide === 'back') {
      let descriptionPlaceholderSvg = '';
      const descriptionAreaHeightPx = 32 * UI_SCALE_FACTOR; // Standard for all back cards
      let descriptionAreaYStartPx = 0;

      // Unified dimensions for Item and Warrior card backs based on Item specs
      // Item cards back: Top row 14mm, Card description 32mm, Bottom row 13mm
      // Total height = 14 + 32 + 13 = 59mm
      const topRowHeightPx = 14 * UI_SCALE_FACTOR;         // Unified to Item spec
      // Description height is fixed at 32mm, so it's already descriptionAreaHeightPx

      descriptionAreaYStartPx = topRowHeightPx;
      const yPos2Px = topRowHeightPx + descriptionAreaHeightPx; // End of description, start of bottom row

      separatorLinesSvg = `
  <line x1="${lineX1}" y1="${topRowHeightPx}" x2="${lineX2}" y2="${topRowHeightPx}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />
  <line x1="${lineX1}" y1="${yPos2Px}" x2="${lineX2}" y2="${yPos2Px}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />`;

      const topSectionCenterYPx = topRowHeightPx / 2;
      const titleActualBaselineYPx = topSectionCenterYPx + (titleFontSizePx * capHeightRatio / 2);

      titleTextSvg = `<text x="${fullCardWidthPx / 2}" y="${titleActualBaselineYPx}" font-family="Anton SC, Arial, sans-serif" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="alphabetic">` +
                      `<tspan font-size="${largeBFontSizePx}px">B</tspan>` +
                      `<tspan font-size="${titleFontSizePx}px">arcode</tspan>` +
                      `<tspan dx="${spaceAdjustmentDx}px" font-size="${largeBFontSizePx}px">B</tspan>` +
                      `<tspan font-size="${titleFontSizePx}px">attler</tspan>` +
                    `</text>`;
      
      // Add description placeholder for the back
      descriptionPlaceholderSvg = `<rect x="${lineInsetPx}" y="${descriptionAreaYStartPx}" width="${fullCardWidthPx - 2 * lineInsetPx}" height="${descriptionAreaHeightPx}" fill="#f0f0f0" />` +
                                  `<text x="${fullCardWidthPx / 2}" y="${descriptionAreaYStartPx + descriptionAreaHeightPx / 2}" font-family="Arial, sans-serif" font-size="${titleFontSizePx * 0.8}px" fill="#b0b0b0" text-anchor="middle" dominant-baseline="middle">DESCRIPTION</text>`;
      
      titleTextSvg = titleTextSvg + descriptionPlaceholderSvg;

    } else { // cardSide === 'front'
      titleTextSvg = ''; // No "Barcode Battler" title on the front

      // Unified dimensions for Warrior and Item card fronts
      const topTitleRowHeightPx = 12 * UI_SCALE_FACTOR; // Unified to Warrior spec
      const imageHeightPx = 37 * UI_SCALE_FACTOR;       // Unified to Warrior spec (59 - 12 - 10 = 37)
      const bottomRowHeightPx = 10 * UI_SCALE_FACTOR; // Unified to Warrior spec

      // Define separator lines for the front
      const frontLine1Y = topTitleRowHeightPx;
      const frontLine2Y = topTitleRowHeightPx + imageHeightPx;
      separatorLinesSvg = `
  <line x1="${lineX1}" y1="${frontLine1Y}" x2="${lineX2}" y2="${frontLine1Y}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />
  <line x1="${lineX1}" y1="${frontLine2Y}" x2="${lineX2}" y2="${frontLine2Y}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />`;

      // Placeholder for image (full height)
      const imagePlaceholderSvg = `<rect x="${lineInsetPx}" y="${topTitleRowHeightPx}" width="${fullCardWidthPx - 2 * lineInsetPx}" height="${imageHeightPx}" fill="#e0e0e0" />` +
                                 `<text x="${fullCardWidthPx / 2}" y="${topTitleRowHeightPx + imageHeightPx / 2}" font-family="Anton SC, Arial, sans-serif" font-weight="bold" fill="#a0a0a0" text-anchor="middle" dominant-baseline="middle" font-size="${titleFontSizePx*1.5}px">IMAGE</text>`;
      
      // Card Type and Insert instruction
      const cardTypeFontSizePx = 4 * UI_SCALE_FACTOR;
      const insertFontSizePx = 3 * UI_SCALE_FACTOR;
      const cardTypeYPosPx = (topTitleRowHeightPx / 2) + (cardTypeFontSizePx * capHeightRatio / 3); // Adjusted for visual centering
      const insertTextYPosPx = cardTypeYPosPx + insertFontSizePx * 1.2; // Position "Insert" below card type

      const cardTypeName = currentCardType?.toUpperCase() || '';
      let cardTypeTextSvg = `<text x="${fullCardWidthPx - lineInsetPx - (UI_SCALE_FACTOR * 2)}" y="${cardTypeYPosPx}" font-family="Anton SC, Arial, sans-serif" font-size="${cardTypeFontSizePx}px" fill="black" text-anchor="end" dominant-baseline="alphabetic">${escapeXml(cardTypeName)}</text>`;
      cardTypeTextSvg += `<text x="${fullCardWidthPx - lineInsetPx - (UI_SCALE_FACTOR * 2)}" y="${insertTextYPosPx}" font-family="Arial, sans-serif" font-size="${insertFontSizePx}px" fill="black" text-anchor="end" dominant-baseline="alphabetic"><tspan font-family="monospace" font-size="${insertFontSizePx*1.5}px" dy="-${insertFontSizePx*0.1}px">▶</tspan> Insert</text>`;
      
      // Card Title (Name) Placeholder - Top Left
      const namePlaceholderText = "NAME";
      const namePlaceholderFontSizePx = cardTypeFontSizePx * 1.1; // Similar size to card type
      // Use the same Y as cardType for alignment, but anchor to start (left)
      const namePlaceholderXPosPx = lineInsetPx + (UI_SCALE_FACTOR * 2);
      const namePlaceholderSvg = `<text x="${namePlaceholderXPosPx}" y="${cardTypeYPosPx}" font-family="Anton SC, Arial, sans-serif" font-size="${namePlaceholderFontSizePx}px" fill="#a0a0a0" text-anchor="start" dominant-baseline="alphabetic">${escapeXml(namePlaceholderText)}</text>`;

      // Bottom row text (HP for Warriors, Type-Acronym for Items)
      const bottomTextYPosPx = topTitleRowHeightPx + imageHeightPx + (bottomRowHeightPx / 2) + (titleFontSizePx * capHeightRatio / 2);
      let bottomRowTextLeftSvg = ''; 

      if (currentCardType === 'Soldier' || currentCardType === 'Wizard') {
        const hpValue = data.stats?.hp || 0;
        const hpText = `HP ${hpValue}`;
        bottomRowTextLeftSvg = `<text x="${lineInsetPx + (UI_SCALE_FACTOR * 2)}" y="${bottomTextYPosPx}" font-family="Anton SC, Arial, sans-serif" font-size="${titleFontSizePx}px" fill="black" text-anchor="start" dominant-baseline="alphabetic">${escapeXml(hpText)}</text>`;
      } else if (currentCardType === 'Weapon' || currentCardType === 'Armour' || currentCardType === 'PowerUp') {
        // Determine acronym and value based on item type
        let acronym = '';
        let value: number | undefined = undefined; // Initialize value that can be undefined (0 is a valid stat)

        if (currentCardType === 'Weapon' && data.stats?.st !== undefined) {
          acronym = 'ST'; value = data.stats.st;
        } else if (currentCardType === 'Armour' && data.stats?.df !== undefined) {
          acronym = 'DF'; value = data.stats.df;
        } else if (currentCardType === 'PowerUp') {
          // For PowerUp, determine the stat. A PowerUp card should ideally boost one primary stat.
          // Check in a preferred order or based on which stat is available.
          if (data.stats?.hp !== undefined) { acronym = 'HP'; value = data.stats.hp; }
          else if (data.stats?.st !== undefined) { acronym = 'ST'; value = data.stats.st; }
          else if (data.stats?.df !== undefined) { acronym = 'DF'; value = data.stats.df; }
          // Future: else if (data.stats?.dx !== undefined) { acronym = 'DX'; value = data.stats.dx; }
          // Future: else if (data.stats?.pp !== undefined) { acronym = 'PP'; value = data.stats.pp; }
          // Future: else if (data.stats?.mp !== undefined) { acronym = 'MP'; value = data.stats.mp; }
        }
        
        // Only construct and set bottomRowTextLeftSvg if a valid acronym and value were found
        if (acronym && value !== undefined) { 
            const itemText = `${acronym} ${value}`; // Display only acronym and value
            bottomRowTextLeftSvg = `<text x="${lineInsetPx + (UI_SCALE_FACTOR * 2)}" y="${bottomTextYPosPx}" font-family="Anton SC, Arial, sans-serif" font-size="${titleFontSizePx}px" fill="black" text-anchor="start" dominant-baseline="alphabetic">${escapeXml(itemText)}</text>`;
        } else {
            // If no specific stat is found for the item type, clear the text.
            bottomRowTextLeftSvg = ''; 
        }
      }

      // Add ENEMY text for Soldiers/Wizards if not a hero
      let enemyTextSvg = '';
      if ((currentCardType === 'Soldier' || currentCardType === 'Wizard') && data.isHero === false) {
        const enemyText = "ENEMY";
        // Position ENEMY text on the right side of the bottom row
        const enemyTextXPosPx = fullCardWidthPx - lineInsetPx - (UI_SCALE_FACTOR * 2); 
        enemyTextSvg = `<text x="${enemyTextXPosPx}" y="${bottomTextYPosPx}" font-family="Anton SC, Arial, sans-serif" font-size="${titleFontSizePx}px" fill="black" text-anchor="end" dominant-baseline="alphabetic">${escapeXml(enemyText)}</text>`;
      }

      // Assemble front card elements
      // Order matters for SVG rendering (later elements on top)
      // Ensure enemyTextSvg is included here
      titleTextSvg = namePlaceholderSvg + imagePlaceholderSvg + cardTypeTextSvg + bottomRowTextLeftSvg + enemyTextSvg;
    }
    // --- End of separator lines ---

    const tempJsBarcodeSvgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const jsBarcodeOptions: JsBarcode.Options = {
      format: barcodeFormat,
      displayValue: false,
      margin: 0,
      height: 50,
      fontSize: 0, // Changed from 12
      textMargin: 0, // Changed from 2
      width: 2,
    };

    try {
      JsBarcode(tempJsBarcodeSvgElement, barcodeValue, jsBarcodeOptions);
    } catch (e) {
      console.error("JsBarcode generation failed inside helper:", e);
      return '';
    }

    const actualGeneratedBarcodeWidthPx = parseFloat(tempJsBarcodeSvgElement.getAttribute('width') || '0');
    const actualGeneratedBarcodeHeightPxByAttr = parseFloat(tempJsBarcodeSvgElement.getAttribute('height') || '0');
    const jsBarcodeInnerContent = tempJsBarcodeSvgElement.innerHTML;

    if (actualGeneratedBarcodeWidthPx === 0 || actualGeneratedBarcodeHeightPxByAttr === 0) {
        console.error("JsBarcode generated an SVG with zero dimensions. Width:", actualGeneratedBarcodeWidthPx, "Height:", actualGeneratedBarcodeHeightPxByAttr);
        return '';
    }

    const barcodeContentEffectiveHeightPx = 
      jsBarcodeOptions.displayValue === false && jsBarcodeOptions.height
        ? jsBarcodeOptions.height 
        : actualGeneratedBarcodeHeightPxByAttr;

    // Returns the inner content: a rect for the card background, title text, separator lines, and the barcode group
    // The parent SVG will define the overall size and viewBox for scaling.
    return `
  <rect width="100%" height="100%" fill="white" stroke="black" stroke-width="1px" rx="${cardCornerRadiusPx}px" ry="${cardCornerRadiusPx}px" />
  ${titleTextSvg}
  ${separatorLinesSvg}
  ${cardSide === 'back' ? `
  <g transform="translate(${barcodeXUnrotatedPx}, ${barcodeYUnrotatedPx}) rotate(180 ${barcodeOnCardWidthPx / 2} ${barcodeOnCardHeightPx / 2})">
    <svg
      width="${barcodeOnCardWidthPx}"
      height="${barcodeOnCardHeightPx}"
      viewBox="0 0 ${actualGeneratedBarcodeWidthPx} ${barcodeContentEffectiveHeightPx}"
      preserveAspectRatio="xMidYMid meet"
    >
      ${jsBarcodeInnerContent}
    </svg>
  </g>` : ''}
`;
  }, [data, t, UI_SCALE_FACTOR, antonScFontDataUrl]); // Added UI_SCALE_FACTOR and antonScFontDataUrl to dependencies

  useEffect(() => {
    const svgContainerBack = barcodeUiCardBackRef.current;
    const svgContainerFront = barcodeUiCardFrontRef.current;

    if (data.barcode && data.isValid) {
      if (svgContainerBack) {
        try {
          const cardSvgContentBack = generateCardSvgContent( // Use the memoized version from the component scope
            data.barcode,
            data.barcode.length === 8 ? "EAN8" : "EAN13",
            'back'
          );
          
          if (cardSvgContentBack) {
            const cardViewWidthPx = 86 * UI_SCALE_FACTOR;
            const cardViewHeightPx = 59 * UI_SCALE_FACTOR;

            svgContainerBack.setAttribute('width', cardViewWidthPx.toString());
            svgContainerBack.setAttribute('height', cardViewHeightPx.toString());
            svgContainerBack.setAttribute('viewBox', `0 0 ${cardViewWidthPx} ${cardViewHeightPx}`);
            svgContainerBack.innerHTML = cardSvgContentBack; 
          } else {
            svgContainerBack.innerHTML = '';
          }
        } catch (e) {
          console.error("UI Card/Barcode generation failed (Back):", e);
          svgContainerBack.innerHTML = '';
        }
      }
      if (svgContainerFront) {
        try {
          const cardSvgContentFront = generateCardSvgContent( // Use the memoized version from the component scope
            data.barcode,
            data.barcode.length === 8 ? "EAN8" : "EAN13",
            'front'
          );
          
          if (cardSvgContentFront) {
            const cardViewWidthPx = 86 * UI_SCALE_FACTOR;
            const cardViewHeightPx = 59 * UI_SCALE_FACTOR;

            svgContainerFront.setAttribute('width', cardViewWidthPx.toString());
            svgContainerFront.setAttribute('height', cardViewHeightPx.toString());
            svgContainerFront.setAttribute('viewBox', `0 0 ${cardViewWidthPx} ${cardViewHeightPx}`);
            svgContainerFront.innerHTML = cardSvgContentFront; 
          } else {
            svgContainerFront.innerHTML = '';
          }
        } catch (e) {
          console.error("UI Card/Barcode generation failed (Front):", e);
          svgContainerFront.innerHTML = '';
        }
      }
    } else {
      if (svgContainerBack) svgContainerBack.innerHTML = '';
      if (svgContainerFront) svgContainerFront.innerHTML = '';
    }
  }, [data, t, generateCardSvgContent]); // Added generateCardSvgContent to useEffect dependencies

  const handleDownloadBarcode = async () => {
    if (data.barcode && data.isValid) {
      try {
        const cardSvgContentFront = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13",
          'front'
        );
        const cardSvgContentBack = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13",
          'back'
        );

        if (!cardSvgContentFront || !cardSvgContentBack) {
          console.error("Failed to generate SVG content for download.");
          return;
        }

        const cardWidthMM = 86;
        const cardHeightMM = 59;
        const downloadViewBoxWidthPx = cardWidthMM * UI_SCALE_FACTOR;
        const downloadViewBoxHeightPx = cardHeightMM * UI_SCALE_FACTOR;

        const fontDefs = `
  <defs>
    <style type="text/css">
      <![CDATA[
        @font-face {
          font-family: 'Anton SC';
          src: url(${antonScFontDataUrl}) format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      ]]>
    </style>
  </defs>`;
        
        const createSvgBlobUrl = (content: string, side: 'FRONT' | 'BACK') => {
          const finalCardSvgString = `
<svg
  width="${cardWidthMM}mm"
  height="${cardHeightMM}mm"
  viewBox="0 0 ${downloadViewBoxWidthPx} ${downloadViewBoxHeightPx}"
  xmlns="http://www.w3.org/2000/svg"
>
  ${fontDefs}
  ${content}
</svg>`;
          const blob = new Blob([finalCardSvgString], { type: 'image/svg+xml;charset=utf-8' });
          return {
            url: URL.createObjectURL(blob),
            filename: `barcode-card-${side}-${data.barcode}.svg`
          };
        };

        const downloadLink = (blobUrl: string, filename: string) => {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        };

        const frontSvg = createSvgBlobUrl(cardSvgContentFront, 'FRONT');
        downloadLink(frontSvg.url, frontSvg.filename);

        const backSvg = createSvgBlobUrl(cardSvgContentBack, 'BACK');
        downloadLink(backSvg.url, backSvg.filename);

      } catch (e) {
        console.error("Barcode card SVG download failed:", e);
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (data.barcode && data.isValid) {
      try {
        const cardSvgContentFront = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13",
          'front'
        );
        const cardSvgContentBack = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13",
          'back'
        );

        if (!cardSvgContentFront || !cardSvgContentBack) {
          console.error("Failed to generate SVG content for PDF download.");
          return;
        }

        const cardWidthMM = 86;
        const cardHeightMM = 59;
        const svgViewBoxWidth = cardWidthMM * UI_SCALE_FACTOR;
        const svgViewBoxHeight = cardHeightMM * UI_SCALE_FACTOR;
        const targetDpi = 300;
        const cardWidthInches = cardWidthMM / 25.4;
        const cardHeightInches = cardHeightMM / 25.4;
        const exportCanvasWidth = Math.round(cardWidthInches * targetDpi);
        const exportCanvasHeight = Math.round(cardHeightInches * targetDpi);

        const fontDefs = `
  <defs>
    <style type="text/css">
      <![CDATA[
        @font-face {
          font-family: 'Anton SC';
          src: url(${antonScFontDataUrl}) format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      ]]>
    </style>
  </defs>`;

        const createPngDataUrl = (svgContent: string): Promise<string> => {
          return new Promise((resolve, reject) => {
            const finalSvgStringForRender = `
<svg
  width="${exportCanvasWidth}"
  height="${exportCanvasHeight}"
  viewBox="0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}"
  xmlns="http://www.w3.org/2000/svg"
>
  ${fontDefs}
  ${svgContent}
</svg>`;
            const canvas = document.createElement('canvas');
            canvas.width = exportCanvasWidth;
            canvas.height = exportCanvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject("Could not get canvas context for PDF generation.");
              return;
            }
            const img = new Image();
            const svgBlob = new Blob([finalSvgStringForRender], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            img.onload = () => {
              ctx.drawImage(img, 0, 0, exportCanvasWidth, exportCanvasHeight);
              URL.revokeObjectURL(url);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (e) => {
              URL.revokeObjectURL(url);
              reject("Error loading SVG image for PDF conversion: " + e);
            };
            img.src = url;
          });
        };

        const frontImgData = await createPngDataUrl(cardSvgContentFront);
        const backImgData = await createPngDataUrl(cardSvgContentBack);
        
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [cardWidthMM, cardHeightMM]
        });

        pdf.addImage(frontImgData, 'PNG', 0, 0, cardWidthMM, cardHeightMM);
        pdf.addPage();
        pdf.addImage(backImgData, 'PNG', 0, 0, cardWidthMM, cardHeightMM);
        pdf.save(`barcode-card-FRONT-BACK-${data.barcode}.pdf`);

      } catch (e) {
        console.error("Barcode card PDF download failed:", e);
      }
    }
  };

  const handleDownloadPng = async () => {
    if (data.barcode && data.isValid) {
      try {
        const cardSvgContentFront = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13",
          'front'
        );
        const cardSvgContentBack = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13",
          'back'
        );

        if (!cardSvgContentFront || !cardSvgContentBack) {
          console.error("Failed to generate SVG content for PNG download.");
          return;
        }

        const cardWidthMM = 86;
        const cardHeightMM = 59; 
        const svgViewBoxWidth = cardWidthMM * UI_SCALE_FACTOR;
        const svgViewBoxHeight = cardHeightMM * UI_SCALE_FACTOR;
        const targetDpi = 300;
        const cardWidthInches = cardWidthMM / 25.4;
        const cardHeightInches = cardHeightMM / 25.4;
        const exportCanvasWidth = Math.round(cardWidthInches * targetDpi);
        const exportCanvasHeight = Math.round(cardHeightInches * targetDpi);

        const fontDefs = `
  <defs>
    <style type="text/css">
      <![CDATA[
        @font-face {
          font-family: 'Anton SC';
          src: url(${antonScFontDataUrl}) format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      ]]>
    </style>
  </defs>`;

        const createPngAndDownload = (svgContent: string, side: 'FRONT' | 'BACK') => {
          const finalSvgStringForRender = `
<svg
  width="${exportCanvasWidth}"
  height="${exportCanvasHeight}"
  viewBox="0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}"
  xmlns="http://www.w3.org/2000/svg"
>
  ${fontDefs}
  ${svgContent}
</svg>`;
          const canvas = document.createElement('canvas');
          canvas.width = exportCanvasWidth;
          canvas.height = exportCanvasHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error("Could not get canvas context for PNG generation.");
            return;
          }
          const img = new Image();
          const svgBlob = new Blob([finalSvgStringForRender], {type: 'image/svg+xml;charset=utf-8'});
          const url = URL.createObjectURL(svgBlob);
          img.onload = () => {
            ctx.drawImage(img, 0, 0, exportCanvasWidth, exportCanvasHeight);
            URL.revokeObjectURL(url);
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = `barcode-card-${side}-${data.barcode}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };
          img.onerror = (e) => {
            console.error(`Error loading SVG image for PNG conversion (${side}):`, e);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        };

        createPngAndDownload(cardSvgContentFront, 'FRONT');
        createPngAndDownload(cardSvgContentBack, 'BACK');

      } catch (e) {
        console.error("Barcode card PNG download failed:", e);
      }
    }
  };

  const cardPropertyKeys = [
    'cardType', 'powerUpType', 'stats.hp', 'stats.st', 'stats.df', 'stats.dx', 'stats.pp', 'stats.mp',
    'race', 'occupation', 'flag', 'isHero', 'isSingleUse',
  ];
  const parsingDetailKeys = [
    'barcode', 'barcodeType', 'isValid', 'errorKey', 'methodUsed', 'reasonKey' // Added barcodeType
  ];

  const cardPropertyData = Object.entries(flatData)
    .filter(([key]) => cardPropertyKeys.includes(key))
    .filter(([, value]) => value !== undefined && value !== null);

  const parsingDetailData = Object.entries(flatData)
    .filter(([key]) => parsingDetailKeys.includes(key))
    .filter(([, value]) => value !== undefined && value !== null);

  const digitMappings = data.digitMappings || {} as Record<string, DigitMappingDetail>;

  const handleHighlight = (fieldKey: string) => {
    const mappingDetail = digitMappings[fieldKey];
    if (mappingDetail?.indices) {
      setHighlightedDigits(mappingDetail.indices);
    } else {
      // Special handling for reason if it has context with indices
      if (fieldKey === 'reasonKey' && data.reasonContext?.indices) {
         setHighlightedDigits(data.reasonContext.indices);
      } else {
         setHighlightedDigits(null);
      }
    }
  };

  const handleMouseLeaveTable = () => {
    setHighlightedDigits(null);
  };

  const renderValue = (value: unknown): React.ReactNode => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (typeof value === 'boolean') {
        return value ? t('true') : t('false');
      }
      // Don't render keys directly as values
      if (typeof value === 'string' && (value.startsWith('reason') || value.startsWith('error'))) {
          return ''; // Or some placeholder if needed
      }
      return String(value);
    } else if (value === null || value === undefined) {
      return '';
    } else {
      return t('unsupportedValueType');
    }
  };

  const fieldLabelKeys: Record<string, string> = {
    barcode: 'fieldLabelBarcode',
    barcodeType: 'fieldLabelBarcodeType', // Added barcodeType
    isValid: 'fieldLabelIsValid',
    errorKey: 'fieldLabelError', // Changed from error
    methodUsed: 'fieldLabelMethodUsed',
    reasonKey: 'fieldLabelReason', // Changed from reason
    cardType: 'fieldLabelCardType',
    powerUpType: 'fieldLabelPowerUpType',
    'stats.hp': 'fieldLabelHp',
    'stats.st': 'fieldLabelSt',
    'stats.df': 'fieldLabelDf',
    'stats.dx': 'fieldLabelDx',
    'stats.pp': 'fieldLabelPp',
    'stats.mp': 'fieldLabelMp',
    race: 'fieldLabelRace',
    occupation: 'fieldLabelOccupation',
    flag: 'fieldLabelFlag',
    isHero: 'fieldLabelIsHero',
    isSingleUse: 'fieldLabelIsSingleUse',
  };

  const staticExplanationKeys: Record<string, string> = {
    barcode: 'explanationBarcode',
    isValid: 'explanationIsValid',
    methodUsed: 'explanationMethodUsed',
    race: 'explanationRace', // Add a generic explanation key for race
    // barcodeType explanation is dynamic via digitMappings
  };

  const renderTable = (titleKey: string, tableData: [string, any][]) => (
    <div style={{ marginBottom: '20px' }}>
      <h3>{t(titleKey)}</h3>
      <table
        className="parsed-data-table"
        onMouseLeave={handleMouseLeaveTable}
      >
        <thead>
          <tr>
            <th>{t('tableHeaderField')}</th>
            <th>{t('tableHeaderValue')}</th>
            {showExplanations && <th className="explanation-header">{t('tableHeaderExplanation')}</th>}
          </tr>
        </thead>
        <tbody>
          {tableData.map(([key, value]) => {
            let displayExplanation: string = t('noExplanationAvailable'); // Initialize as string
            const mappingDetail = digitMappings[key];
            const staticExplanationKey = staticExplanationKeys[key];
            const labelKey = fieldLabelKeys[key] || key;
            const displayLabel = t(labelKey);
            let hasMapping = !!mappingDetail?.indices;

            // Get dynamic explanation from digitMappings
            if (mappingDetail?.explanationKey) {
              // Ensure the result is treated as a string
              displayExplanation = String(t(mappingDetail.explanationKey, mappingDetail.explanationContext || {}));
            }
            // Get dynamic explanation for reasonKey/errorKey
            else if (key === 'reasonKey' && data.reasonKey) {
              // Ensure the result is treated as a string
              displayExplanation = String(t(data.reasonKey, data.reasonContext || {}));
              hasMapping = !!data.reasonContext?.indices; // Check if reason context provides indices
            } else if (key === 'errorKey' && data.errorKey) {
              // Ensure the result is treated as a string
              displayExplanation = String(t(data.errorKey, data.errorContext || {}));
            }
            // Fallback to static explanation if no dynamic one exists
            else if (staticExplanationKey) {
              displayExplanation = t(staticExplanationKey);
            }

            // Special case for Flag: Add flag effect text
            if (key === 'flag' && typeof value === 'number') {
              const flagEffectKey = `flagEffects.${value}`;
              // Ensure the result is treated as a string
              const flagEffectText = String(t(flagEffectKey, { defaultValue: '' }));
              if (flagEffectText) {
                // Append if there's already an explanation, otherwise set it.
                if (displayExplanation !== t('noExplanationAvailable') && displayExplanation !== t(staticExplanationKeys.race)) {
                    displayExplanation += ` (${flagEffectText})`;
                } else {
                    displayExplanation = flagEffectText;
                }
              }
            }

            // Special case for Race: Add race name to the explanation
            if (key === 'race' && typeof value === 'number') {
              const raceNameKey = `raceNames.${value}`;
              const raceNameText = String(t(raceNameKey, { defaultValue: '' }));
              if (raceNameText) {
                // If the current explanation is the generic one for race or no explanation, replace it.
                // Otherwise, append the race name.
                if (displayExplanation === t(staticExplanationKeys.race) || displayExplanation === t('noExplanationAvailable')) {
                  displayExplanation = raceNameText;
                } else {
                  displayExplanation += ` (${raceNameText})`;
                }
              }
            }

            const valueCellStyle: React.CSSProperties = { textAlign: 'right' };

            // Don't render rows for keys if they are just keys (like reasonKey, errorKey)
            if (key === 'reasonKey' || key === 'errorKey') {
                if (!showExplanations) return null; // Only show in explanation column
                return (
                  <tr
                    key={key}
                    className={hasMapping ? 'highlightable-row' : ''}
                    onMouseEnter={() => handleHighlight(key)}
                    onClick={() => handleHighlight(key)}
                  >
                    <td>{displayLabel}</td>
                    <td style={valueCellStyle}></td>
                    {showExplanations && (
                      <td className="explanation-cell">
                        {displayExplanation}
                      </td>
                    )}
                  </tr>
                );
            }

            return (
              <tr
                key={key}
                className={hasMapping ? 'highlightable-row' : ''}
                onMouseEnter={() => handleHighlight(key)}
                onClick={() => handleHighlight(key)}
              >
                <td>{displayLabel}</td>
                <td style={valueCellStyle}>{renderValue(value)}</td>
                {showExplanations && (
                  <td className="explanation-cell">
                    {displayExplanation}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {data.barcode && data.isValid && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' }}>
            <div>
              <h4>{t('cardFrontTitle')}</h4>
              <svg ref={barcodeUiCardFrontRef}></svg>
            </div>
            <div>
              <h4>{t('cardBackTitle')}</h4>
              <svg ref={barcodeUiCardBackRef}></svg>
            </div>
          </div>
          <div>
            <button onClick={handleDownloadBarcode} style={{ marginTop: '10px' }}>
              {t('downloadCardButtonSvgAll')}
            </button>
            <button onClick={handleDownloadPdf} style={{ marginTop: '10px', marginLeft: '10px' }}>
              {t('downloadCardButtonPdfAll')}
            </button>
            <button onClick={handleDownloadPng} style={{ marginTop: '10px', marginLeft: '10px' }}>
              {t('downloadCardButtonPngAll')}
            </button>
          </div>
        </div>
      )}
      {/* Ensure tables are rendered only if there is data for them */}
      {cardPropertyData.length > 0 && renderTable('cardPropertiesTitle', cardPropertyData)}
      {parsingDetailData.length > 0 && renderTable('parsingDetailsTitle', parsingDetailData)}
    </div>
  );
};

export default ParsedDataDisplay;
