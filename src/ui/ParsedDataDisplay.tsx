import React from 'react';
import { useTranslation } from 'react-i18next';
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
    'barcode', 'isValid', 'errorKey', 'methodUsed', 'reasonKey',
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

  const flatData = flattenData(data);
  const cardPropertyKeys = [
    'cardType', 'powerUpType', 'stats.hp', 'stats.st', 'stats.df', 'stats.dx', 'stats.pp', 'stats.mp',
    'race', 'occupation', 'flag', 'isHero', 'isSingleUse',
  ];
  const parsingDetailKeys = [
    'barcode', 'isValid', 'errorKey', 'methodUsed', 'reasonKey' // Use reasonKey
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
      {cardPropertyData.length > 0 && renderTable('cardPropertiesTitle', cardPropertyData)}
      {parsingDetailData.length > 0 && renderTable('parsingDetailsTitle', parsingDetailData)}
    </div>
  );
};

export default ParsedDataDisplay;
