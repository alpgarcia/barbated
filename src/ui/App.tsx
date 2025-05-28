import { useState } from 'react'
import { useTranslation } from 'react-i18next'; // Import useTranslation
import './App.css'
import { parseBarcode, ParsedBarcodeData } from '../lib/barcode-parser'
import ParsedDataDisplay from './ParsedDataDisplay'

// New component to display the barcode with highlighting
interface BarcodeDisplayProps {
  barcode: string;
  highlightedIndices: number[] | null;
  methodUsed?: 1 | 2 | 'Exception'; // Add methodUsed prop
  showLetters: boolean; // Add prop to control letter display
}

const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({ barcode, highlightedIndices, methodUsed, showLetters }) => {
  const method1Letters = 'ABCDEFGHIJKLM'.split(''); // 13 letters
  const method2LettersMap: { [index: number]: string } = {
    [13 - 6]: 'P', // Index 7
    [13 - 5]: 'Q', // Index 8
    [13 - 4]: 'R', // Index 9
    [13 - 3]: 'S', // Index 10
    [13 - 2]: 'T', // Index 11
    [13 - 1]: 'U'  // Index 12 (Check Digit)
  };

  const displayLength = barcode.length;
  const indexOffset = displayLength === 13 ? 0 : 5;

  return (
    <div className="barcode-display-container">
      {barcode.split('').map((digit, index) => {
        const effectiveIndex = index + indexOffset;
        let letter = '';
        if (showLetters && methodUsed && methodUsed !== 'Exception') {
          if (methodUsed === 1 && effectiveIndex < method1Letters.length) {
            letter = method1Letters[effectiveIndex];
          } else if (methodUsed === 2 && method2LettersMap[effectiveIndex]) {
            letter = method2LettersMap[effectiveIndex];
          }
        }

        const isHighlighted = highlightedIndices?.includes(index);

        return (
          <div
            key={index}
            className={`barcode-digit ${isHighlighted ? 'highlighted' : ''}`}
          >
            {/* Letter (conditionally rendered) */}
            {showLetters && (
              <div className="barcode-letter">
                {letter || '\u00A0'}
              </div>
            )}
            {/* Digit */}
            <div className={isHighlighted ? 'bold' : ''}>
              {digit}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function App() {
  const { t } = useTranslation(); // Get translation function
  const [barcode, setBarcode] = useState('')
  const [parsedData, setParsedData] = useState<ParsedBarcodeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExplanations, setShowExplanations] = useState(false)
  const [highlightedDigits, setHighlightedDigits] = useState<number[] | null>(null) // State for highlighted digits
  const [customImage, setCustomImage] = useState<string | null>(null); // State for custom image
  const [cardName, setCardName] = useState<string>(''); // State for card name
  const [cardDescription, setCardDescription] = useState<string>(''); // State for card description

  const handleParse = () => {
    try {
      const result = parseBarcode(barcode)
      setParsedData(result)
      setError(null)
      setHighlightedDigits(null) // Reset highlight on new parse
      setCardName(''); // Reset card name on new parse
      setCustomImage(null); // Reset custom image on new parse
      setCardDescription(''); // Reset card description on new parse
    } catch (err) {
      setParsedData(null)
      // Use translation key for unknown error, parser errors will be keys now
      setError(err instanceof Error ? err.message : t('barcodeUnknownError'))
      setHighlightedDigits(null)
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setCustomImage(null);
    }
  };

  const userManualUrl = `${import.meta.env.BASE_URL}USER_MANUAL.md`;

  return (
    <>
      <div className="user-manual-link-container">
        <a href={userManualUrl} target="_blank" rel="noopener noreferrer">
          {t('userManualLink')}
        </a>
      </div>

      <h1>{t('appTitle')}</h1>
      <div className="input-container">
        <label htmlFor="barcode-input">{t('barcodeInputLabel')}</label>
        <input
          id="barcode-input"
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder={t('barcodeInputPlaceholder')} // Translate placeholder
        />
        <button onClick={handleParse}>{t('parseButton')}</button>
      </div>

      {error && (
        <div className="error-message">
          {/* Translate the "Error:" prefix and the error message itself if it's a key */}
          <p>{t('errorPrefix')} {t(error)}</p>
        </div>
      )}

      {/* Conditionally render BarcodeDisplay outside results-container */}
      {parsedData && (
        <BarcodeDisplay
          barcode={parsedData.barcode}
          highlightedIndices={highlightedDigits}
          methodUsed={parsedData.methodUsed}
          showLetters={showExplanations} // Keep showing letters based on explanation toggle
        />
      )}

      {/* Keep results-container for the rest */}
      {parsedData && (
        <div className="results-container">
          <div className="explanation-toggle">
            <label>
              <input
                type="checkbox"
                checked={showExplanations}
                onChange={(e) => setShowExplanations(e.target.checked)}
              />
              {t('showExplanationsLabel')} {/* Translate label */}
            </label>
          </div>
          <div className="table-container">
            <ParsedDataDisplay
              data={parsedData}
              showExplanations={showExplanations}
              setHighlightedDigits={setHighlightedDigits}
              customImage={customImage} // Pass custom image to ParsedDataDisplay
              onImageUpload={handleImageUpload} // Pass the handler
              cardName={cardName} // Pass cardName
              onCardNameChange={setCardName} // Pass cardName setter
              cardDescription={cardDescription} // Pass cardDescription
              onCardDescriptionChange={setCardDescription} // Pass cardDescription setter
            />
          </div>
        </div>
      )}
    </>
  )
}

export default App
