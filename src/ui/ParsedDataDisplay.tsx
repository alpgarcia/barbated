import React from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { ParsedBarcodeData, DigitMappingDetail } from '../lib/barcode-parser';

interface ParsedDataDisplayProps {
  data: ParsedBarcodeData;
  showExplanations: boolean;
  setHighlightedDigits: (indices: number[] | null) => void;
}

// Helper to flatten the data object for display
const flattenData = (data: ParsedBarcodeData): Record<string, string | number | boolean | undefined> => {
  const flat: Record<string, string | number | boolean | undefined> = {};

  // Flatten top-level properties, excluding 'stats'
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'stats') {
      flat[key] = value;
    }
  }

  // Flatten stats if they exist
  if (data.stats) {
    for (const [statKey, statValue] of Object.entries(data.stats)) {
      // Type check for statValue
      if (typeof statValue === 'string' || typeof statValue === 'number' || typeof statValue === 'boolean') {
        flat[`stats.${statKey}`] = statValue;
      } else {
        // Handle 'unknown' type, e.g., convert to string or assign a default
        flat[`stats.${statKey}`] = String(statValue); // Example: Convert to string
      }
    }
  }

  const orderedFlat: Record<string, string | number | boolean | undefined> = {};
  const preferredOrder = [
    'barcode', 'isValid', 'error', 'methodUsed', 'reason',
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
  const { t } = useTranslation(); // Get the translation function

  const flatData = flattenData(data);
  const cardPropertyKeys = [
    'cardType', 'powerUpType', 'stats.hp', 'stats.st', 'stats.df', 'stats.dx', 'stats.pp', 'stats.mp',
    'race', 'occupation', 'flag', 'isHero', 'isSingleUse',
  ];
  const parsingDetailKeys = [
    'barcode', 'isValid', 'error', 'methodUsed', 'reason'
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
      setHighlightedDigits(null);
    }
  };

  const handleMouseLeaveTable = () => {
    setHighlightedDigits(null);
  };

  const renderValue = (value: unknown): React.ReactNode => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      // Use translation for boolean true/false if needed, otherwise String() is fine
      if (typeof value === 'boolean') {
        return value ? t('true') : t('false');
      }
      return String(value);
    } else if (value === null || value === undefined) {
      return ''; // Or display 'N/A'
    } else {
      // Optionally handle other types, e.g., stringify objects/arrays for debugging
      // return JSON.stringify(value);
      return t('unsupportedValueType'); // Use translation key
    }
  };

  // Map internal keys to translation keys for labels
  const fieldLabelKeys: Record<string, string> = {
    barcode: 'fieldLabelBarcode',
    isValid: 'fieldLabelIsValid',
    error: 'fieldLabelError',
    methodUsed: 'fieldLabelMethodUsed',
    reason: 'fieldLabelReason',
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

  // Map internal keys to translation keys for static explanations
  const staticExplanationKeys: Record<string, string> = {
    barcode: 'explanationBarcode',
    isValid: 'explanationIsValid',
    error: 'explanationError',
    methodUsed: 'explanationMethodUsed',
    reason: 'explanationReason',
  };

  const renderTable = (titleKey: string, tableData: [string, string | number | boolean | undefined][]) => (
    <div style={{ marginBottom: '20px' }}>
      <h3>{t(titleKey)}</h3> {/* Use translation key for title */}
      <table
        className="parsed-data-table"
        onMouseLeave={handleMouseLeaveTable}
      >
        <thead>
          <tr>
            <th>{t('tableHeaderField')}</th> {/* Use translation key */}
            <th>{t('tableHeaderValue')}</th> {/* Use translation key */}
            {showExplanations && <th className="explanation-header">{t('tableHeaderExplanation')}</th>} {/* Use translation key */}
          </tr>
        </thead>
        <tbody>
          {tableData.map(([key, value]) => {
            const dynamicExplanation = digitMappings[key]?.explanation;
            const staticExplanationKey = staticExplanationKeys[key];
            const fallbackExplanation = t('noExplanationAvailable'); // Use translation key
            let displayExplanation = dynamicExplanation ?? (staticExplanationKey ? t(staticExplanationKey) : fallbackExplanation);
            const labelKey = fieldLabelKeys[key] || key; // Get the label key
            const displayLabel = t(labelKey); // Translate the label
            const hasMapping = !!digitMappings[key]?.indices;

            // Always align value cell to the right
            const valueCellStyle: React.CSSProperties = { textAlign: 'right' };

            // Get flag effect explanation using translation
            if (key === 'flag' && typeof value === 'number') {
              const flagEffectKey = `flagEffects.${value}`;
              const flagEffectText = t(flagEffectKey, { defaultValue: '' }); // Provide defaultValue to avoid missing key errors
              if (flagEffectText) {
                displayExplanation += ` (${flagEffectText})`;
              }
            }

            return (
              <tr
                key={key}
                className={hasMapping ? 'highlightable-row' : ''}
                onMouseEnter={() => handleHighlight(key)}
                onClick={() => handleHighlight(key)}
              >
                <td>{displayLabel}</td>
                {/* Apply the style directly */}
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
      {/* Use translation keys for table titles */}
      {cardPropertyData.length > 0 && renderTable('cardPropertiesTitle', cardPropertyData)}
      {parsingDetailData.length > 0 && renderTable('parsingDetailsTitle', parsingDetailData)}
    </div>
  );
};

export default ParsedDataDisplay;
