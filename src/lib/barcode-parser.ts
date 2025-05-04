/**
 * Details for mapping a parsed field back to the barcode digits.
 */
export interface DigitMappingDetail {
  indices: number[];
  explanationKey: string; // Key for translation
  explanationContext?: Record<string, any>; // Context for interpolation
}

/**
 * Represents the parsed data from a Barcode Battler II barcode.
 */
export interface ParsedBarcodeData {
  barcode: string;
  barcodeType?: 'EAN-8' | 'EAN-13/UPC-A' | 'Unknown'; // Added barcode type
  isValid: boolean;
  errorKey?: string; // Key for translation
  errorContext?: Record<string, any>; // Context for interpolation
  methodUsed?: 1 | 2 | 'Exception';
  reasonKey?: string; // Key for translation
  reasonContext?: Record<string, any>; // Context for interpolation
  cardType?: 'Soldier' | 'Wizard' | 'Weapon' | 'Armour' | 'PowerUp' | 'Unknown';
  stats?: {
    hp: number;
    st: number;
    df: number;
    dx: number;         // Digit J (Called 'speed' in barcode-battler-engine)
    pp?: number;        // Power Points (Set to 5 for Method 1 Fighters based on barcode-battler-engine)
    mp?: number;        // Magic Points (Set to 10 if I>=6 for Method 1 Fighters based on barcode-battler-engine)
  };
  race?: number; // 0: Mech, 1: Animal, 2: Oceanic, 3: Bird, 4: Human
  occupation?: number; // 0-9
  flag?: number; // 0-99
  isHero?: boolean;
  isSingleUse?: boolean; // For Weapons/Armour
  powerUpType?: 'Health' | 'Herb' | 'Magic' | 'VagueNews' | 'AccurateNews';
  digitMappings?: Record<string, DigitMappingDetail>; // Map field names to source digit indices and explanation
}

// Helper function to safely parse digits
function safeParseInt(char: string | undefined): number {
  return parseInt(char || '0', 10);
}

// --- Exception Handling ---
// Update exceptions to use keys and context
const exceptions: { [barcode: string]: Partial<ParsedBarcodeData> } = {
  '4905040352507': { // Barcode Battler (Original Console)
    barcode: '4905040352507',
    isValid: true,
    methodUsed: 'Exception',
    reasonKey: 'reasonExceptionEpoch',
    reasonContext: { productName: 'Barcode Battler Console' },
    cardType: 'Soldier',
    stats: { hp: 5200, st: 1500, df: 100, dx: 6, pp: 5, mp: 0 },
    race: 1,
    occupation: 0,
    flag: 50,
    isHero: true,
  },
  '4905040352521': { // Barcode Battler II Console
    barcode: '4905040352521',
    isValid: true,
    methodUsed: 'Exception',
    reasonKey: 'reasonExceptionEpoch',
    reasonContext: { productName: 'Barcode Battler II Console' },
    cardType: 'Wizard',
    stats: { hp: 5200, st: 1500, df: 100, dx: 7, pp: 5, mp: 10 },
    race: 1,
    occupation: 8,
    flag: 50,
    isHero: true,
  },
  // Original Heroes - Update reasonKey and add reasonContext
  '0120401154185': { barcode: '0120401154185', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Rarman' } },
  '0120201044181': { barcode: '0120201044181', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'U-Ronchan' } },
  '0120102308184': { barcode: '0120102308184', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Bon-Curry' } },
  '0150604154187': { barcode: '0150604154187', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Cha-Han' } },
  '0180506308180': { barcode: '0180506308180', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Meatman' } },
};

const originalHeroBarcodes = new Set(Object.keys(exceptions).filter(bc => exceptions[bc].reasonKey === 'reasonExceptionOriginalHero'));

/**
 * Parses a Barcode Battler II barcode string.
 * @param barcode The 13-digit UPC-A/EAN-13 or 8-digit EAN-8 barcode string.
 * @returns ParsedBarcodeData object.
 */
export function parseBarcode(barcode: string): ParsedBarcodeData {
  const cleanedBarcode = barcode.replace(/\s+/g, ''); // Remove spaces if any
  const baseResult: ParsedBarcodeData = { barcode: cleanedBarcode, isValid: false };
  let barcodeType: ParsedBarcodeData['barcodeType'] = 'Unknown';
  let barcodeTypeExplanationKey = 'explanationBarcodeTypeUnknown';

  // --- Basic Validation (Use keys) ---
  if (!/^\d+$/.test(cleanedBarcode)) {
    return { ...baseResult, errorKey: 'barcodeInvalidChars' };
  }
  if (cleanedBarcode.length === 8) {
      barcodeType = 'EAN-8';
      barcodeTypeExplanationKey = 'explanationBarcodeTypeEan8';
  } else if (cleanedBarcode.length === 13) {
      barcodeType = 'EAN-13/UPC-A';
      barcodeTypeExplanationKey = 'explanationBarcodeTypeEan13Upca';
  } else {
      return { ...baseResult, errorKey: 'barcodeInvalidLength' };
  }

  // Add barcodeType mapping early
  const digitMappings: Record<string, DigitMappingDetail> = {
      'barcodeType': { indices: [], explanationKey: barcodeTypeExplanationKey, explanationContext: { length: cleanedBarcode.length } }
  };

  // --- Check for Hardcoded Exceptions ---
  if (exceptions[cleanedBarcode] && !originalHeroBarcodes.has(cleanedBarcode)) {
      // Return pre-defined Epoch product data directly
      // Merge early mappings with exception data
      const exceptionData = exceptions[cleanedBarcode];
      return {
          ...baseResult,
          ...exceptionData,
          isValid: true,
          barcodeType, // Add determined type
          digitMappings: { ...digitMappings, ...exceptionData.digitMappings } // Merge mappings
      } as ParsedBarcodeData;
  }

  let methodUsed: 1 | 2;
  let reasonKey: string;
  let reasonContext: Record<string, any> | undefined;
  let parsedData: Partial<ParsedBarcodeData> = {};

  // --- Determine Method (Use keys and context) ---
  if (barcodeType === 'EAN-8') {
    methodUsed = 2;
    reasonKey = 'reasonMethod2Ean8';
    const paddedBarcode = '00000' + cleanedBarcode;
    // Pass existing mappings to Method 2
    parsedData = parseMethod2(paddedBarcode, reasonKey, undefined, digitMappings);
  } else { // EAN-13/UPC-A
    const A = safeParseInt(cleanedBarcode[0]);
    const C = safeParseInt(cleanedBarcode[2]);
    const J = safeParseInt(cleanedBarcode[9]);

    if (A > 2 && (C < 9 || J !== 5)) {
      methodUsed = 2;
      reasonKey = 'reasonMethod1Rejected';
      reasonContext = { A, C, J };
      // Pass existing mappings to Method 2
      parsedData = parseMethod2(cleanedBarcode, reasonKey, reasonContext, digitMappings);
    } else {
      methodUsed = 1;
      reasonKey = 'reasonMethod1Met';
      // Pass A, C, J for the explanation context
      reasonContext = { A, C, J };
      // Pass existing mappings and context to Method 1
      parsedData = parseMethod1(cleanedBarcode, reasonKey, reasonContext, digitMappings);
    }
  }

  // --- Apply Original Hero Exception Override ---
  if (originalHeroBarcodes.has(cleanedBarcode)) {
      const exceptionData = exceptions[cleanedBarcode];
      parsedData.methodUsed = 'Exception';
      parsedData.reasonKey = exceptionData.reasonKey;
      parsedData.reasonContext = exceptionData.reasonContext;
      // Ensure digitMappings exists before modifying
      parsedData.digitMappings = parsedData.digitMappings || {};
      if (parsedData.stats) {
          parsedData.flag = 50;
          parsedData.isHero = true;
          // Update digit mapping for flag and isHero if they exist
          // Find original flag indices (might be complex if Method 2 was initially used)
          const originalFlagIndices = parsedData.digitMappings['flag']?.indices || [];
          parsedData.digitMappings['flag'] = {
              indices: originalFlagIndices, // Keep original indices for reference?
              explanationKey: 'explanationFlagMethod2Hero', // Assuming Method 2 hero flag explanation is suitable
              explanationContext: { flag: 50, T: '?' } // T is unknown here, maybe omit or mark
          };
          parsedData.digitMappings['isHero'] = {
              indices: [], // No specific digits determine this override
              explanationKey: 'explanationIsHeroMethod2', // Assuming Method 2 hero explanation is suitable
              explanationContext: { isHero: true, T: '?' }
          };
      }
  }

  return {
    ...baseResult,
    isValid: true,
    barcodeType, // Include barcodeType in final result
    methodUsed: parsedData.methodUsed || methodUsed,
    reasonKey: parsedData.reasonKey || reasonKey,
    reasonContext: parsedData.reasonContext || reasonContext,
    ...parsedData,
    // Ensure digitMappings from parsing function are merged correctly
    digitMappings: { ...digitMappings, ...parsedData.digitMappings },
  };
}

// --- Method 1 Implementation (Update explanations to keys/context) ---
// Accept initial digitMappings and reasonContext
function parseMethod1(barcode: string, reasonKey: string, reasonContext: Record<string, any>, initialDigitMappings: Record<string, DigitMappingDetail>): Partial<ParsedBarcodeData> {
  // Start with initial mappings (e.g., barcodeType)
  const digitMappings: Record<string, DigitMappingDetail> = { ...initialDigitMappings };

  const A = safeParseInt(barcode[0]);
  const B = safeParseInt(barcode[1]);
  const C = safeParseInt(barcode[2]);
  const D = safeParseInt(barcode[3]);
  const E = safeParseInt(barcode[4]);
  const F = safeParseInt(barcode[5]);
  const G = safeParseInt(barcode[6]);
  const H = safeParseInt(barcode[7]);
  const I = safeParseInt(barcode[8]);
  const J = safeParseInt(barcode[9]);
  const K = safeParseInt(barcode[10]);
  const L = safeParseInt(barcode[11]);

  let hp = A * 10000 + B * 1000 + C * 100;
  digitMappings['stats.hp'] = {
    indices: [0, 1, 2],
    explanationKey: 'explanationHpMethod1',
    explanationContext: { hp, A, B, C }
  };

  let baseSt = D * 1000 + E * 100;
  let baseDf = F * 1000 + G * 100;
  let st = baseSt;
  let df = baseDf;
  const stIndices = [3, 4];
  const dfIndices = [5, 6];

  // Initial mappings (will be updated later)
  digitMappings['stats.st'] = { indices: [...stIndices], explanationKey: 'explanationStBaseMethod1', explanationContext: { D, E } };
  digitMappings['stats.df'] = { indices: [...dfIndices], explanationKey: 'explanationDfBaseMethod1', explanationContext: { F, G } };

  const dx = J;
  digitMappings['stats.dx'] = {
    indices: [9],
    explanationKey: 'explanationDxMethod1',
    explanationContext: { dx, J }
  };

  const flag = K * 10 + L;
  digitMappings['flag'] = {
    indices: [10, 11],
    explanationKey: 'explanationFlagMethod1',
    explanationContext: { flag, K, L }
  };

  let stAddition = 0;
  let dfAddition = 0;
  let additionExplanationParts: string[] = []; // Build explanation parts
  if (A > 2) {
      if (H === 0 || H === 2) {
          stAddition = 10000;
          stIndices.push(7);
          additionExplanationParts.push(`H(${H}) is 0 or 2, add 10000 to ST.`);
      }
      if (H === 1 || H === 2) {
          dfAddition = 10000;
          dfIndices.push(7);
          additionExplanationParts.push(`H(${H}) is 1 or 2, add 10000 to DF.`);
      }
  }
  const additionExplanation = additionExplanationParts.join(' ');

  let cardType: ParsedBarcodeData['cardType'] = 'Unknown';
  let race: number | undefined = undefined;
  let occupation: number | undefined = undefined;
  let isSingleUse: boolean | undefined = undefined;
  let powerUpType: ParsedBarcodeData['powerUpType'] = undefined;
  let pp: number | undefined = undefined;
  let mp: number | undefined = undefined;

  const cardTypeIndices = [7];
  let cardTypeExplanationKey = '';
  let cardTypeExplanationContext: Record<string, any> = { H, I };

  if (H >= 0 && H <= 4) { // Soldier or Wizard
    race = H;
    digitMappings['race'] = { indices: [7], explanationKey: 'explanationRaceMethod1', explanationContext: { race, H } };
    occupation = I;
    digitMappings['occupation'] = { indices: [8], explanationKey: 'explanationOccupationMethod1', explanationContext: { occupation, I } };
    cardType = (I >= 7) ? 'Wizard' : 'Soldier';
    cardTypeIndices.push(8);
    cardTypeExplanationKey = 'explanationCardTypeMethod1Char';
    cardTypeExplanationContext.cardType = cardType;

    st += stAddition;
    df += dfAddition;
    digitMappings['stats.st'] = { indices: stIndices, explanationKey: 'explanationStMethod1Char', explanationContext: { st, baseSt, stAddition, A, additionExplanation, indices: stIndices.join(', ') } };
    digitMappings['stats.df'] = { indices: dfIndices, explanationKey: 'explanationDfMethod1Char', explanationContext: { df, baseDf, dfAddition, A, additionExplanation, indices: dfIndices.join(', ') } };

    pp = 5;
    digitMappings['stats.pp'] = { indices: [], explanationKey: 'explanationPpMethod1', explanationContext: { pp } };
    mp = (I >= 6) ? 10 : 0;
    digitMappings['stats.mp'] = { indices: [8], explanationKey: 'explanationMpMethod1', explanationContext: { mp, I } };

  } else if (H === 5 || H === 6) { // Weapon
    cardType = 'Weapon';
    occupation = I;
    digitMappings['occupation'] = { indices: [8], explanationKey: 'explanationOccupationMethod1', explanationContext: { occupation, I } };
    isSingleUse = (H === 5);
    digitMappings['isSingleUse'] = { indices: [7], explanationKey: 'explanationSingleUseMethod1', explanationContext: { isSingleUse, H, value: 5 } };
    cardTypeExplanationKey = 'explanationCardTypeMethod1Weapon';

    st += stAddition;
    digitMappings['stats.st'] = { indices: stIndices, explanationKey: 'explanationStMethod1Weapon', explanationContext: { st, baseSt, stAddition, A, additionExplanation, indices: stIndices.join(', ') } };

    df = 0;
    digitMappings['stats.df'] = { indices: dfIndices, explanationKey: 'explanationDfMethod1Weapon', explanationContext: { baseDf: F * 1000 + G * 100 } };

    hp = 0;
    digitMappings['stats.hp'].explanationKey = 'explanationHpMethod1WeaponArmour';
    digitMappings['stats.hp'].explanationContext = { cardType: 'Weapons', baseHp: A * 10000 + B * 1000 + C * 100 };

  } else if (H === 7 || H === 8) { // Armour
    cardType = 'Armour';
    occupation = I;
    digitMappings['occupation'] = { indices: [8], explanationKey: 'explanationOccupationMethod1', explanationContext: { occupation, I } };
    isSingleUse = (H === 7);
    digitMappings['isSingleUse'] = { indices: [7], explanationKey: 'explanationSingleUseMethod1', explanationContext: { isSingleUse, H, value: 7 } };
    cardTypeExplanationKey = 'explanationCardTypeMethod1Armour';

    df += dfAddition;
    digitMappings['stats.df'] = { indices: dfIndices, explanationKey: 'explanationDfMethod1Armour', explanationContext: { df, baseDf, dfAddition, A, additionExplanation, indices: dfIndices.join(', ') } };

    st = 0;
    digitMappings['stats.st'] = { indices: stIndices, explanationKey: 'explanationStMethod1Armour', explanationContext: { baseSt: D * 1000 + E * 100 } };

    hp = 0;
    digitMappings['stats.hp'].explanationKey = 'explanationHpMethod1WeaponArmour';
    digitMappings['stats.hp'].explanationContext = { cardType: 'Armour', baseHp: A * 10000 + B * 1000 + C * 100 };

  } else if (H === 9) { // Power-Up
    cardType = 'PowerUp';
    cardTypeIndices.push(8);
    cardTypeExplanationKey = 'explanationCardTypeMethod1PowerUp';
    cardTypeExplanationContext.I = I;

    const baseHpPowerup = A * 10000 + B * 1000 + C * 100;
    const baseStPowerup = D * 1000 + E * 100;
    const baseDfPowerup = F * 1000 + G * 100;

    if (I >= 0 && I <= 4) { // Health
        powerUpType = 'Health';
        st = 0; df = 0;
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1HealthPowerUp', explanationContext: { baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1HealthPowerUp', explanationContext: { baseDf: baseDfPowerup } };
        // HP mapping remains as calculated initially
    } else if (I === 5 || I === 6) { // News
        powerUpType = (I === 5) ? 'VagueNews' : 'AccurateNews';
        hp = 0; st = 0; df = 0;
        digitMappings['stats.hp'].explanationKey = 'explanationHpMethod1NewsPowerUp';
        digitMappings['stats.hp'].explanationContext = { baseHp: baseHpPowerup };
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1NewsPowerUp', explanationContext: { baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1NewsPowerUp', explanationContext: { baseDf: baseDfPowerup } };
    } else if (I === 7) { // Herb
        powerUpType = 'Herb';
        pp = D * 100 + E;
        digitMappings['stats.pp'] = { indices: [3, 4], explanationKey: 'explanationPpMethod1Herb', explanationContext: { pp, D, E } };
        hp = 0; st = 0; df = 0;
        digitMappings['stats.hp'].explanationKey = 'explanationHpMethod1HerbPowerUp';
        digitMappings['stats.hp'].explanationContext = { baseHp: baseHpPowerup };
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1HerbPowerUp', explanationContext: { D, E, baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1HerbPowerUp', explanationContext: { baseDf: baseDfPowerup } };
    } else { // I = 8 or 9 (Magic)
        powerUpType = 'Magic';
        mp = F * 100 + G;
        digitMappings['stats.mp'] = { indices: [5, 6], explanationKey: 'explanationMpMethod1Magic', explanationContext: { mp, F, G } };
        hp = 0; st = 0; df = 0;
        digitMappings['stats.hp'].explanationKey = 'explanationHpMethod1MagicPowerUp';
        digitMappings['stats.hp'].explanationContext = { baseHp: baseHpPowerup };
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1MagicPowerUp', explanationContext: { baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1MagicPowerUp', explanationContext: { F, G, baseDf: baseDfPowerup } };
    }
    digitMappings['powerUpType'] = { indices: [8], explanationKey: 'explanationPowerUpTypeMethod1', explanationContext: { powerUpType, I } };
  }

  digitMappings['cardType'] = { indices: cardTypeIndices, explanationKey: cardTypeExplanationKey, explanationContext: cardTypeExplanationContext };

  const isHero = (flag === 19 || flag === 50) && hp < 6000 && st < 2000 && df < 2000;
  const heroCheckIndices = [
      ...(digitMappings['flag']?.indices || []),
      ...(digitMappings['stats.hp']?.indices || []),
      ...(digitMappings['stats.st']?.indices || []),
      ...(digitMappings['stats.df']?.indices || []),
  ].filter((val, idx, self) => self.indexOf(val) === idx);

  digitMappings['isHero'] = {
      indices: heroCheckIndices,
      explanationKey: 'explanationIsHeroMethod1',
      explanationContext: { isHero, flag, hp, st, df, indices: heroCheckIndices.join(', ') }
  };

  const finalStats: any = { hp, st, df, dx };
  if (pp !== undefined) finalStats.pp = pp;
  if (mp !== undefined) finalStats.mp = mp;
  if (finalStats.hp < 0) finalStats.hp = 0;
  if (finalStats.st < 0) finalStats.st = 0;
  if (finalStats.df < 0) finalStats.df = 0;

  return {
    methodUsed: 1,
    reasonKey,
    reasonContext,
    cardType,
    stats: finalStats,
    race,
    occupation,
    flag,
    isHero,
    isSingleUse,
    powerUpType,
    digitMappings,
  };
}

// --- Method 2 Implementation (Update explanations to keys/context) ---
// Accept initial digitMappings
function parseMethod2(barcode: string, reasonKey: string, reasonContext: Record<string, any> | undefined, initialDigitMappings: Record<string, DigitMappingDetail>): Partial<ParsedBarcodeData> {
  // Start with initial mappings (e.g., barcodeType)
  const digitMappings: Record<string, DigitMappingDetail> = { ...initialDigitMappings };
  const len = barcode.length;

  const pIdx = len - 6;
  const qIdx = len - 5;
  const rIdx = len - 4;
  const sIdx = len - 3;
  const tIdx = len - 2;

  const P = safeParseInt(barcode[pIdx]);
  const Q = safeParseInt(barcode[qIdx]);
  const R = safeParseInt(barcode[rIdx]);
  const S = safeParseInt(barcode[sIdx]);
  const T = safeParseInt(barcode[tIdx]);

  let hp = 0;
  let st = 0;
  let df = 0;
  const dx = 0;

  digitMappings['stats.dx'] = { indices: [], explanationKey: 'explanationDxMethod2', explanationContext: { dx } };

  const cardTypeIndices = [tIdx];
  let cardType: ParsedBarcodeData['cardType'] = 'Unknown';

  let flag = 10 * P + R;
  let flagExplanationKey = 'explanationFlagMethod2';
  let flagExplanationContext: Record<string, any> = { flag, P, R, pIdx, rIdx };
  const flagIndices = [pIdx, rIdx];
  const originalFlag = flag;

  if (flag > 29 && T >= 5) {
      flag = 0;
      flagExplanationKey = 'explanationFlagMethod2Adjusted';
      flagExplanationContext = { flag, P, R, originalFlag, T, pIdx, rIdx, tIdx };
      flagIndices.push(tIdx);
  }
  digitMappings['flag'] = { indices: flagIndices, explanationKey: flagExplanationKey, explanationContext: flagExplanationContext };

  let isHero = false;
  let isSingleUse: boolean | undefined = undefined;
  let powerUpType: ParsedBarcodeData['powerUpType'] = undefined;
  let cardTypeExplanationKey = '';
  let cardTypeExplanationContext: Record<string, any> = { T, tIdx };

  if (T < 5) { // Soldier or Wizard (Method 2 implies Hero)
    cardType = 'Soldier'; // Method 2 doesn't distinguish Soldier/Wizard
    cardTypeExplanationKey = 'explanationCardTypeMethod2Hero';

    hp = (1000 * (10 * Math.floor(S / 2) + R)) + (100 * Q);
    digitMappings['stats.hp'] = { indices: [qIdx, rIdx, sIdx], explanationKey: 'explanationHpMethod2Hero', explanationContext: { hp, S, R, Q, qIdx, rIdx, sIdx } };
    st = 1000 * ((R + 5) % 10 + 2) + 100 * ((Q + 5) % 10);
    digitMappings['stats.st'] = { indices: [qIdx, rIdx], explanationKey: 'explanationStMethod2Hero', explanationContext: { st, R, Q, qIdx, rIdx } };
    df = 1000 * ((Q + 7) % 10) + 100 * ((P + 7) % 10);
    digitMappings['stats.df'] = { indices: [pIdx, qIdx], explanationKey: 'explanationDfMethod2Hero', explanationContext: { df, Q, P, pIdx, qIdx } };

    flag = 50;
    digitMappings['flag'] = { indices: [tIdx], explanationKey: 'explanationFlagMethod2Hero', explanationContext: { flag, T, originalFlag, tIdx } };
    isHero = true;
    digitMappings['isHero'] = { indices: [tIdx], explanationKey: 'explanationIsHeroMethod2', explanationContext: { isHero, T, tIdx } };

  } else if (T === 5 || T === 6) { // Weapon
    cardType = 'Weapon';
    cardTypeExplanationKey = 'explanationCardTypeMethod2Weapon';
    st = 1000 * (1 + Math.floor(R / 4)) + 100 * ((Q + 5) % 10);
    digitMappings['stats.st'] = { indices: [qIdx, rIdx], explanationKey: 'explanationStMethod2Weapon', explanationContext: { st, R, Q, qIdx, rIdx } };
    isSingleUse = (T === 5);
    digitMappings['isSingleUse'] = { indices: [tIdx], explanationKey: 'explanationSingleUseMethod2Weapon', explanationContext: { isSingleUse, T, tIdx } };
    hp = 0; df = 0;
    digitMappings['stats.hp'] = { indices: [], explanationKey: 'explanationHpMethod2Weapon' };
    digitMappings['stats.df'] = { indices: [], explanationKey: 'explanationDfMethod2Weapon' };

  } else if (T === 7 || T === 8) { // Armour
    cardType = 'Armour';
    cardTypeExplanationKey = 'explanationCardTypeMethod2Armour';
    df = 1000 * Math.floor(Q / 4) + 100 * ((P + 7) % 10);
    digitMappings['stats.df'] = { indices: [pIdx, qIdx], explanationKey: 'explanationDfMethod2Armour', explanationContext: { df, Q, P, pIdx, qIdx } };
    isSingleUse = (T === 7);
    digitMappings['isSingleUse'] = { indices: [tIdx], explanationKey: 'explanationSingleUseMethod2Armour', explanationContext: { isSingleUse, T, tIdx } };
    hp = 0; st = 0;
    digitMappings['stats.hp'] = { indices: [], explanationKey: 'explanationHpMethod2Armour' };
    digitMappings['stats.st'] = { indices: [], explanationKey: 'explanationStMethod2Armour' };

  } else if (T > 8) { // Health Power-Up
    cardType = 'PowerUp';
    powerUpType = 'Health';
    cardTypeExplanationKey = 'explanationCardTypeMethod2PowerUp';
    digitMappings['powerUpType'] = { indices: [tIdx], explanationKey: 'explanationPowerUpTypeMethod2', explanationContext: { powerUpType, T, tIdx } };
    hp = 10000 * Math.floor(S / 8) + 1000 * R + 100 * Q;
    digitMappings['stats.hp'] = { indices: [qIdx, rIdx, sIdx], explanationKey: 'explanationHpMethod2PowerUp', explanationContext: { hp, S, R, Q, qIdx, rIdx, sIdx } };
    st = 0; df = 0;
    digitMappings['stats.st'] = { indices: [], explanationKey: 'explanationStMethod2PowerUp' };
    digitMappings['stats.df'] = { indices: [], explanationKey: 'explanationDfMethod2PowerUp' };
  }

  digitMappings['cardType'] = { indices: cardTypeIndices, explanationKey: cardTypeExplanationKey, explanationContext: cardTypeExplanationContext };

  return {
    methodUsed: 2,
    reasonKey,
    reasonContext,
    cardType,
    stats: { hp, st, df, dx },
    flag,
    isHero,
    isSingleUse,
    powerUpType,
    digitMappings,
  };
}
