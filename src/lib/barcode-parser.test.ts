import { parseBarcode } from './barcode-parser';
import { testBarcodes } from './test-data/known-barcodes';

describe('Barcode Parser', () => {
  testBarcodes.forEach(({ barcode, expected }) => {
    test(`should parse barcode ${barcode} correctly`, () => {
      const result = parseBarcode(barcode);

      // Check validity first
      if (expected.errorKey) { 
        expect(result.isValid).toBe(false);
        expect(result.errorKey).toBeDefined();
        expect(result.errorKey).toBe(expected.errorKey);
        // If the expected error is barcodeInvalidLength, also check barcodeType is Unknown
        if (expected.errorKey === 'barcodeInvalidLength') {
            expect(result.barcodeType).toBe('Unknown');
        } else if (expected.errorKey === 'barcodeInvalidChars' || expected.errorKey === 'barcodeInvalidCheckDigit') {
            // For these errors, barcodeType should be determined if length was valid
            if (barcode.replace(/\s+/g, '').length === 8) {
                expect(result.barcodeType).toBe('EAN-8');
            } else if (barcode.replace(/\s+/g, '').length === 13) {
                expect(result.barcodeType).toBe('EAN-13/UPC-A');
            }
        }
        return;
      }

      // If no error expected, check validity and other fields
      expect(result.isValid).toBe(true);
      expect(result.errorKey).toBeUndefined();

      // Check specific fields
      if (expected.methodUsed !== undefined) {
        expect(result.methodUsed).toBe(expected.methodUsed);
      }
      if (expected.cardType !== undefined) {
        expect(result.cardType).toBe(expected.cardType);
      }
      if (expected.stats !== undefined) {
        expect(result.stats).toEqual(expected.stats);
      }
      if (expected.race !== undefined) {
        expect(result.race).toBe(expected.race);
      }
      if (expected.occupation !== undefined) {
        expect(result.occupation).toBe(expected.occupation);
      }
      if (expected.flag !== undefined) {
        expect(result.flag).toBe(expected.flag);
      }
       if (expected.isHero !== undefined) {
        expect(result.isHero).toBe(expected.isHero);
      }
      if (expected.isSingleUse !== undefined) {
        expect(result.isSingleUse).toBe(expected.isSingleUse);
      }
       if (expected.powerUpType !== undefined) {
        expect(result.powerUpType).toBe(expected.powerUpType);
      }
    });
  });

  test('should parse barcode 1340912373503 correctly', () => {
    const result = parseBarcode('1340912373503');
    expect(result.isValid).toBe(false);
    expect(result.errorKey).toBe('barcodeInvalidCheckDigit');
    expect(result.barcodeType).toBe('EAN-13/UPC-A');
  });

  test('should handle barcode with spaces', () => {
      const result = parseBarcode('04012 07336 501'); // Rarman-CP with spaces
      expect(result.isValid).toBe(true);
      expect(result.barcode).toBe('0401207336501'); // Check if cleaned
      expect(result.methodUsed).toBe(1);
      expect(result.stats?.hp).toBe(4000);
      expect(result.reasonKey).toBeDefined(); // Check reasonKey exists
  });

});
