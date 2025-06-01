import { useState, useRef } from 'react' // Import useRef
import { useTranslation } from 'react-i18next';
import './App.css'
import { parseBarcode, ParsedBarcodeData } from '../lib/barcode-parser'
import ParsedDataDisplay from './ParsedDataDisplay'
import { SavedCardState } from '../lib/types'; // Import SavedCardState

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
  const { t } = useTranslation();
  const [barcode, setBarcode] = useState('')
  const [parsedData, setParsedData] = useState<ParsedBarcodeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExplanations, setShowExplanations] = useState(false)
  const [highlightedDigits, setHighlightedDigits] = useState<number[] | null>(null)
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [cardName, setCardName] = useState<string>('');
  const [cardDescription, setCardDescription] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  const handleParse = (barcodeToParse?: string) => {
    const currentBarcode = barcodeToParse || barcode;
    if (!currentBarcode) {
      // Use a more specific translation key if available, or a general one.
      setError(t('barcodeCannotBeEmpty', "Barcode cannot be empty.")); 
      setParsedData(null);
      return;
    }
    try {
      const result = parseBarcode(currentBarcode)
      setParsedData(result)
      setError(null)
      setHighlightedDigits(null) 
      // Only reset these if not loading from a file
      if (!barcodeToParse) {
        setCardName(''); 
        setCustomImage(null); 
        setCardDescription(''); 
      }
    } catch (err) {
      setParsedData(null)
      setError(err instanceof Error ? err.message : t('barcodeUnknownError', "An unknown error occurred during parsing."))
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

  const handleSaveCard = async () => {
    if (!parsedData || !parsedData.isValid) { // Also check isValid
      alert(t('noBarcodeToSaveError', "No valid barcode data to save. Please parse a barcode first."));
      return;
    }

    let customImageBase64: string | undefined = undefined;
    if (customImage) {
      if (customImage.startsWith('data:image')) {
        customImageBase64 = customImage;
      } else if (customImage.startsWith('blob:')) {
        try {
          const response = await fetch(customImage);
          const blobValue = await response.blob(); // Renamed to avoid conflict
          customImageBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blobValue); // Use renamed variable
          });
        } catch (e) {
          console.error("Error processing blob image:", e);
          alert(t('imageProcessingError', "Error processing image. Please try a different image or try again."));
          return;
        }
      }
    }

    const cardState: SavedCardState = {
      barcode: parsedData.barcode,
      cardName: cardName || undefined,
      cardDescription: cardDescription || undefined,
      customImageBase64: customImageBase64,
    };

    const jsonData = JSON.stringify(cardState, null, 2);
    const blobJson = new Blob([jsonData], { type: 'application/json' }); // Renamed to avoid conflict
    const url = URL.createObjectURL(blobJson); // Use renamed variable
    const a = document.createElement('a');
    a.href = url;
    const safeCardName = cardName?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'card';
    a.download = `${safeCardName}.json`; // Changed extension to .json
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadCard = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const loadedState = JSON.parse(text) as SavedCardState;
          
          setBarcode(loadedState.barcode); // Update barcode input field
          setCardName(loadedState.cardName || '');
          setCardDescription(loadedState.cardDescription || '');
          setCustomImage(loadedState.customImageBase64 || null);
          
          // Call handleParse with the loaded barcode to update parsedData
          // and other dependent states, without resetting name/desc/img
          handleParse(loadedState.barcode);

        } catch (err) {
          console.error("Error reading or parsing .bbcard file:", err);
          alert(t('fileReadError', "Error reading or parsing the card file. Please ensure it is a valid .bbcard file."));
          setError(t('fileReadError', "Failed to load card data."));
          setParsedData(null);
        }
      };
      reader.onerror = () => {
        console.error("Error reading file:", reader.error);
        alert(t('fileReadError', "Error reading the selected file."));
        setError(t('fileReadError', "Failed to read file."));
        setParsedData(null);
      };
      reader.readAsText(file);
      // Reset file input to allow loading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
        <button onClick={() => handleParse()}>{t('parseButton')}</button> {/* Ensure handleParse is called without args here */}
      </div>

      {/* Load Card Action */}
      <div className="input-container" style={{ alignItems: 'center' }}>
        <span>{t('orLabel')}</span> {/* "Or:" text. marginRight removed, assuming .input-container handles spacing. */}
        <input
          type="file"
          accept=".json"
          onChange={handleLoadCard}
          style={{ display: 'none' }}
          ref={fileInputRef}
        />
        <button onClick={() => fileInputRef.current?.click()}>
          {t('loadCardButton', 'Load Card (.json)')}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {/* Translate the "Error:" prefix and the error message itself if it's a key */}
          <p>{t('errorPrefix', 'Error:')} {t(error)}</p>
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
              onSaveCard={handleSaveCard} // Pass handleSaveCard
            />
          </div>
        </div>
      )}
    </>
  )
}

export default App
