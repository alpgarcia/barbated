import React, { useEffect, useRef } from 'react'; // Added useEffect, useRef
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode'; // Import JsBarcode
import { ParsedBarcodeData, DigitMappingDetail } from '../lib/barcode-parser';

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
  const barcodeRef = useRef<SVGSVGElement>(null); // Ref for the SVG element

  const flatData = flattenData(data);
  const cardPropertyKeys = [
    'cardType', 'powerUpType', 'stats.hp', 'stats.st', 'stats.df', 'stats.dx', 'stats.pp', 'stats.mp',
    'race', 'occupation', 'flag', 'isHero', 'isSingleUse',
  ];
  const parsingDetailKeys = [
    'barcode', 'barcodeType', 'isValid', 'errorKey', 'methodUsed', 'reasonKey' // Added barcodeType
  ];

  // Effect to generate barcode when data.barcode changes
  useEffect(() => {
    if (data.barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, data.barcode, {
          format: data.barcode.length === 8 ? "EAN8" : "EAN13", // Auto-detect format
          displayValue: true, // Show the numbers below the barcode
          // Default size options, can be customized later
          width: 2,
          height: 60,
          margin: 10,
          fontSize: 14,
        });
      } catch (e) {
        // Handle potential errors during barcode generation (e.g., invalid format)
        console.error("Barcode generation failed:", e);
        // Optionally clear the SVG or display an error message
        if (barcodeRef.current) {
            barcodeRef.current.innerHTML = ''; // Clear previous barcode on error
        }
      }
    } else if (barcodeRef.current) {
        barcodeRef.current.innerHTML = ''; // Clear barcode if no data.barcode
    }
  }, [data.barcode]); // Rerun effect when barcode string changes

  // Function to handle barcode download
  const handleDownloadBarcode = () => {
    if (barcodeRef.current && data.barcode && data.isValid) { // Check validity
      const svgElement = barcodeRef.current;
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `barcode-${data.barcode}.svg`; // Set filename
      document.body.appendChild(link); // Required for Firefox
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up
    }
  };

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
      {/* Add SVG element and download button */}
      {data.barcode && data.isValid && ( // Only show if barcode is valid
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <svg ref={barcodeRef}></svg>
          <div> {/* Wrap button for better spacing/styling if needed */}
            <button onClick={handleDownloadBarcode} style={{ marginTop: '10px' }}>
              {t('downloadBarcodeButton')} {/* Make sure this key exists in translation files */}
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
