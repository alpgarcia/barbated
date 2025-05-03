import { parseBarcode } from './barcode-parser';
import { testBarcodes } from './test-data/known-barcodes';

describe('Barcode Parser', () => {
  testBarcodes.forEach(({ barcode, expected }) => {
    test(`should parse barcode ${barcode} correctly`, () => {
      const result = parseBarcode(barcode);

      // Check validity first
      if (expected.errorKey) { // Check for errorKey instead of error
        expect(result.isValid).toBe(false);
        expect(result.errorKey).toBeDefined();
        // Optionally check if the specific errorKey matches
        expect(result.errorKey).toBe(expected.errorKey);
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

  test('should handle barcode with spaces', () => {
      const result = parseBarcode('04012 07336 501'); // Rarman-CP with spaces
      expect(result.isValid).toBe(true);
      expect(result.barcode).toBe('0401207336501'); // Check if cleaned
      expect(result.methodUsed).toBe(1);
      expect(result.stats?.hp).toBe(4000);
      expect(result.reasonKey).toBeDefined(); // Check reasonKey exists
  });

});
