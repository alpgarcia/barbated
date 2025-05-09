import React, { useEffect, useRef } from 'react'; // Added useEffect, useRef
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode'; // Import JsBarcode
import { jsPDF } from 'jspdf'; // Importación para PDF
import { ParsedBarcodeData, DigitMappingDetail } from '../lib/barcode-parser';
import antonScFontDataUrl from '../../fonts/Anton_SC/AntonSC-Regular.ttf?inline'; // Importación para la fuente

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
  const barcodeUiCardRef = useRef<SVGSVGElement>(null);

  const flatData = flattenData(data);

  // Generates the *inner content* of the card SVG (rect and barcode group)
  // All internal dimensions are in scaled pixels based on UI_SCALE_FACTOR
  const generateCardSvgContent = ( 
    barcodeValue: string,
    barcodeFormat: "EAN8" | "EAN13"
  ): string => {
    // Base MM dimensions (used for calculating scaled pixel values)
    const cardWidthMM = 86; // Standard card width
    const cardHeightMM = 59; // Needed for barcode Y position calculation
    const barcodeOnCardWidthMM = 40;
    const barcodeOnCardHeightMM = 10;
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
    const lineStrokeColor = "#cccccc"; // Light grey for subtlety
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

    // Use alphabetic baseline for more consistent rendering across SVG viewers.
    const commonTextAttributes = `font-family="Anton SC, Arial, sans-serif" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="alphabetic"`;

    if (currentCardType === 'Soldier' || currentCardType === 'Wizard') {
      // Warrior cards back: Top row 15mm, Card description 32mm
      const yPos1WarriorPx = 15 * UI_SCALE_FACTOR;
      const yPos2WarriorPx = (15 + 32) * UI_SCALE_FACTOR;
      separatorLinesSvg = `
  <line x1="${lineX1}" y1="${yPos1WarriorPx}" x2="${lineX2}" y2="${yPos1WarriorPx}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />
  <line x1="${lineX1}" y1="${yPos2WarriorPx}" x2="${lineX2}" y2="${yPos2WarriorPx}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />`;

      const topSectionCenterYPx = yPos1WarriorPx / 2;
      // Adjust Y for alphabetic baseline to center the text block based on cap height of the smaller letters.
      const titleActualBaselineYPx = topSectionCenterYPx + (titleFontSizePx * capHeightRatio / 2); 
      
      titleTextSvg = `<text x="${fullCardWidthPx / 2}" y="${titleActualBaselineYPx}" ${commonTextAttributes}>` +
                      `<tspan font-size="${largeBFontSizePx}px">B</tspan>` +
                      `<tspan font-size="${titleFontSizePx}px">arcode</tspan>` +
                      `<tspan dx="${spaceAdjustmentDx}px" font-size="${largeBFontSizePx}px">B</tspan>` +
                      `<tspan font-size="${titleFontSizePx}px">attler</tspan>` +
                    `</text>`;

    } else if (currentCardType === 'Weapon' || currentCardType === 'Armour' || currentCardType === 'PowerUp') {
      // Item cards back: Top row 14mm, Card description 32mm
      const yPos1ItemPx = 14 * UI_SCALE_FACTOR;
      const yPos2ItemPx = (14 + 32) * UI_SCALE_FACTOR;
      separatorLinesSvg = `
  <line x1="${lineX1}" y1="${yPos1ItemPx}" x2="${lineX2}" y2="${yPos1ItemPx}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />
  <line x1="${lineX1}" y1="${yPos2ItemPx}" x2="${lineX2}" y2="${yPos2ItemPx}" stroke="${lineStrokeColor}" stroke-width="${lineStrokeWidth}" />`;
      
      const topSectionCenterYPx = yPos1ItemPx / 2;
      // Adjust Y for alphabetic baseline to center the text block based on cap height of the smaller letters.
      const titleActualBaselineYPx = topSectionCenterYPx + (titleFontSizePx * capHeightRatio / 2);

      titleTextSvg = `<text x="${fullCardWidthPx / 2}" y="${titleActualBaselineYPx}" ${commonTextAttributes}>` +
                      `<tspan font-size="${largeBFontSizePx}px">B</tspan>` +
                      `<tspan font-size="${titleFontSizePx}px">arcode</tspan>` +
                      `<tspan dx="${spaceAdjustmentDx}px" font-size="${largeBFontSizePx}px">B</tspan>` +
                      `<tspan font-size="${titleFontSizePx}px">attler</tspan>` +
                    `</text>`;
    }
    // --- End of separator lines ---

    const tempJsBarcodeSvgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const jsBarcodeOptions: JsBarcode.Options = {
      format: barcodeFormat,
      displayValue: false,
      margin: 0,
      height: 40, // Px height for JsBarcode internal rendering (bars themselves)
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
  <g transform="translate(${barcodeXUnrotatedPx}, ${barcodeYUnrotatedPx}) rotate(180 ${barcodeOnCardWidthPx / 2} ${barcodeOnCardHeightPx / 2})">
    <svg
      width="${barcodeOnCardWidthPx}"
      height="${barcodeOnCardHeightPx}"
      viewBox="0 0 ${actualGeneratedBarcodeWidthPx} ${barcodeContentEffectiveHeightPx}"
      preserveAspectRatio="xMidYMid meet"
    >
      ${jsBarcodeInnerContent}
    </svg>
  </g>`;
  };

  useEffect(() => {
    const svgContainer = barcodeUiCardRef.current;
    if (data.barcode && svgContainer && data.isValid) {
      try {
        const cardSvgContent = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13"
        );
        
        if (cardSvgContent) {
          const cardViewWidthPx = 86 * UI_SCALE_FACTOR;
          const cardViewHeightPx = 59 * UI_SCALE_FACTOR;

          svgContainer.setAttribute('width', cardViewWidthPx.toString());
          svgContainer.setAttribute('height', cardViewHeightPx.toString());
          svgContainer.setAttribute('viewBox', `0 0 ${cardViewWidthPx} ${cardViewHeightPx}`);
          svgContainer.innerHTML = cardSvgContent; // Set the generated inner content
        } else {
          svgContainer.innerHTML = '';
        }

      } catch (e) {
        console.error("UI Card/Barcode generation failed:", e);
        svgContainer.innerHTML = '';
      }
    } else if (svgContainer) {
      svgContainer.innerHTML = '';
    }
  }, [data.barcode, data.isValid, data.barcode?.length]); // Added data.barcode.length to dependencies

  const handleDownloadBarcode = () => {
    if (data.barcode && data.isValid) {
      try {
        const cardSvgContent = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13"
        );

        if (!cardSvgContent) {
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
        
        const finalCardSvgString = `
<svg
  width="${cardWidthMM}mm"
  height="${cardHeightMM}mm"
  viewBox="0 0 ${downloadViewBoxWidthPx} ${downloadViewBoxHeightPx}"
  xmlns="http://www.w3.org/2000/svg"
>
  ${fontDefs}
  ${cardSvgContent}
</svg>`;

        const blob = new Blob([finalCardSvgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `barcode-card-${data.barcode}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Barcode card download failed:", e);
      }
    }
  };

  const handleDownloadPdf = () => {
    if (data.barcode && data.isValid) {
      try {
        const cardSvgContent = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13"
        );

        if (!cardSvgContent) {
          console.error("Failed to generate SVG content for PDF download.");
          return;
        }

        const cardWidthMM = 86;
        const cardHeightMM = 59;

        // Dimensions for the SVG's viewBox, based on UI_SCALE_FACTOR
        // This matches the coordinate system of generateCardSvgContent
        const svgViewBoxWidth = cardWidthMM * UI_SCALE_FACTOR;
        const svgViewBoxHeight = cardHeightMM * UI_SCALE_FACTOR;

        // Target DPI for export
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
        
        const finalSvgStringForRender = `
<svg
  width="${exportCanvasWidth}"
  height="${exportCanvasHeight}"
  viewBox="0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}"
  xmlns="http://www.w3.org/2000/svg"
>
  ${fontDefs}
  ${cardSvgContent}
</svg>`;

        const canvas = document.createElement('canvas');
        canvas.width = exportCanvasWidth;
        canvas.height = exportCanvasHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error("Could not get canvas context for PDF generation.");
          return;
        }

        const img = new Image();
        const svgBlob = new Blob([finalSvgStringForRender], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          ctx.drawImage(img, 0, 0, exportCanvasWidth, exportCanvasHeight);
          URL.revokeObjectURL(url);
          const imgData = canvas.toDataURL('image/png'); 
          
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [cardWidthMM, cardHeightMM]
          });

          pdf.addImage(imgData, 'PNG', 0, 0, cardWidthMM, cardHeightMM);
          pdf.save(`barcode-card-${data.barcode}.pdf`);
        };

        img.onerror = (e) => {
          console.error("Error loading SVG image for PDF conversion:", e);
          URL.revokeObjectURL(url);
        };
        img.src = url;

      } catch (e) {
        console.error("Barcode card PDF download failed:", e);
      }
    }
  };

  const handleDownloadPng = () => {
    if (data.barcode && data.isValid) {
      try {
        const cardSvgContent = generateCardSvgContent(
          data.barcode,
          data.barcode.length === 8 ? "EAN8" : "EAN13"
        );

        if (!cardSvgContent) {
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

        const finalSvgStringForRender = `
<svg
  width="${exportCanvasWidth}"
  height="${exportCanvasHeight}"
  viewBox="0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}"
  xmlns="http://www.w3.org/2000/svg"
>
  ${fontDefs}
  ${cardSvgContent}
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
          link.download = `barcode-card-${data.barcode}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        img.onerror = (e) => {
          console.error("Error loading SVG image for PNG conversion:", e);
          URL.revokeObjectURL(url);
        };

        img.src = url;

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
                displayExplanation += ` (${flagEffectText})`;
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
          <svg ref={barcodeUiCardRef}></svg>
          <div>
            <button onClick={handleDownloadBarcode} style={{ marginTop: '10px' }}>
              {t('downloadCardButtonSvg')}
            </button>
            <button onClick={handleDownloadPdf} style={{ marginTop: '10px', marginLeft: '10px' }}>
              {t('downloadCardButtonPdf')}
            </button>
            <button onClick={handleDownloadPng} style={{ marginTop: '10px', marginLeft: '10px' }}>
              {t('downloadCardButtonPng')}
            </button>
          </div>
        </div>
      )}
      {cardPropertyData.length > 0 && renderTable('cardPropertiesTitle', cardPropertyData)}
      {parsingDetailData.length > 0 && renderTable('parsingDetailsTitle', parsingDetailData)}
    </div>
  );
};

export default ParsedDataDisplay;
