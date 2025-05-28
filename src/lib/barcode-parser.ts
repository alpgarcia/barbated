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
  barcodeType?: BarcodeType; // Updated to use BarcodeType enum
  isValid: boolean;
  errorKey?: string; // Key for translation
  errorContext?: Record<string, any>; // Context for interpolation
  methodUsed?: MethodUsedType; // Updated to use MethodUsedType
  reasonKey?: string; // Key for translation
  reasonContext?: Record<string, any>; // Context for interpolation
  cardType?: CardType; // Updated to use CardType enum
  stats?: {
    hp: number;
    st: number;
    df: number;
    dx: number;
    pp?: number;
    mp?: number;
  };
  race?: number; // 0: Mech, 1: Animal, 2: Oceanic, 3: Bird, 4: Human
  occupation?: number; // 0-9
  flag?: number; // 0-99
  isHero?: boolean;
  isSingleUse?: boolean; // For Weapons/Armour
  powerUpType?: PowerUpType; // Updated to use PowerUpType enum
  digitMappings?: Record<string, DigitMappingDetail>;
  // Fields that were missing in previous attempts or need to be part of the base structure
  rawDump?: string; // Added rawDump as it was used in parseBarcodeSmart logic
  isPsuedoBarcode?: boolean;
  comments?: string[];
  parsedDigits?: number[];
  checkDigit?: number;
  countryCode?: string;
  manufacturerCode?: string;
  productCode?: string;
}

export enum BarcodeType {
  EAN8 = 'EAN-8',
  EAN13_UPCA = 'EAN-13/UPC-A',
  Unknown = 'Unknown'
}

export enum CardType {
  Soldier = 'Soldier',
  Wizard = 'Wizard',
  Weapon = 'Weapon',
  Armour = 'Armour',
  PowerUp = 'PowerUp',
  Unknown = 'Unknown'
}

export enum PowerUpType {
  Health = 'Health',
  Herb = 'Herb',
  Magic = 'Magic',
  VagueNews = 'VagueNews',
  AccurateNews = 'AccurateNews'
}

export type MethodUsedType = 1 | 2 | 'Exception' | undefined;

// Helper function to safely parse digits
function safeParseInt(char: string | undefined): number {
  return parseInt(char || '0', 10);
}

// Helper function to validate EAN-13 check digit
function isValidEan13CheckDigit(barcode: string): boolean {
  if (barcode.length !== 13) {
    return false; // Should have been caught by length check already
  }
  let sumOdd = 0;
  let sumEven = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i], 10);
    if ((i + 1) % 2 !== 0) { // Odd position (1st, 3rd, ...)
      sumOdd += digit;
    } else { // Even position (2nd, 4th, ...)
      sumEven += digit;
    }
  }
  const totalSum = sumOdd + sumEven * 3;
  const calculatedCheckDigit = (10 - (totalSum % 10)) % 10;
  return calculatedCheckDigit === parseInt(barcode[12], 10);
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
    cardType: CardType.Soldier,
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
    cardType: CardType.Wizard,
    stats: { hp: 5200, st: 1500, df: 100, dx: 7, pp: 5, mp: 10 },
    race: 1,
    occupation: 8,
    flag: 50,
    isHero: true,
  },
  // Original Heroes - Update reasonKey and add reasonContext
  '0120401154185': { barcode: '0120401154185', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Rarman' }, cardType: CardType.Soldier },
  '0120201044181': { barcode: '0120201044181', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'U-Ronchan' }, cardType: CardType.Soldier },
  '0120102308184': { barcode: '0120102308184', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Bon-Curry' }, cardType: CardType.Soldier },
  '0150604154187': { barcode: '0150604154187', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Cha-Han' }, cardType: CardType.Soldier },
  '0180506308180': { barcode: '0180506308180', isValid: true, methodUsed: 'Exception', reasonKey: 'reasonExceptionOriginalHero', reasonContext: { heroName: 'Meatman' }, cardType: CardType.Soldier },
};

const originalHeroBarcodes = new Set(Object.keys(exceptions).filter(bc => exceptions[bc].reasonKey === 'reasonExceptionOriginalHero'));

/**
 * Parses a Barcode Battler II barcode string.
 * @param barcode The 13-digit UPC-A/EAN-13 or 8-digit EAN-8 barcode string.
 * @returns ParsedBarcodeData object.
 */
export function parseBarcode(barcode: string): ParsedBarcodeData {
  const cleanedBarcode = barcode.replace(/\s+/g, '');
  const baseResult: ParsedBarcodeData = {
    barcode: cleanedBarcode,
    isValid: false, // Default to false, explicitly set true on success
    rawDump: cleanedBarcode,
    cardType: CardType.Unknown,
    // Initialize all optional fields to undefined or default values
    barcodeType: BarcodeType.Unknown,
    methodUsed: undefined,
    digitMappings: {},
    stats: undefined,
    powerUpType: undefined,
    race: undefined,
    occupation: undefined,
    flag: undefined,
    isHero: undefined,
    isSingleUse: undefined,
    reasonKey: undefined,
    errorKey: undefined,
    reasonContext: undefined,
    errorContext: undefined,
    isPsuedoBarcode: undefined,
    comments: undefined,
    parsedDigits: undefined,
    checkDigit: undefined,
    countryCode: undefined,
    manufacturerCode: undefined,
    productCode: undefined,
  };

  let determinedBarcodeType: BarcodeType = BarcodeType.Unknown;
  let barcodeTypeExplanationKey = 'explanationBarcodeTypeUnknown';

  // 1. Check Length First
  if (cleanedBarcode.length === 8) {
    determinedBarcodeType = BarcodeType.EAN8;
    barcodeTypeExplanationKey = 'explanationBarcodeTypeEan8';
  } else if (cleanedBarcode.length === 13) {
    determinedBarcodeType = BarcodeType.EAN13_UPCA;
    barcodeTypeExplanationKey = 'explanationBarcodeTypeEan13Upca';
  } else {
    // If length is not 8 or 13, it might still have invalid characters.
    // Prioritize length error, but also check for invalid chars for context if needed.
    const hasInvalidChars = !/^\d+$/.test(cleanedBarcode);
    return {
      ...baseResult,
      barcodeType: determinedBarcodeType, // Will be Unknown here
      errorKey: 'barcodeInvalidLength',
      // Optionally, provide context if it also has invalid characters
      errorContext: hasInvalidChars ? { alsoContains: 'barcodeInvalidChars' } : undefined,
      digitMappings: {
        ...baseResult.digitMappings,
        'barcodeType': {
          indices: [],
          explanationKey: barcodeTypeExplanationKey, // 'explanationBarcodeTypeUnknown'
          explanationContext: { length: cleanedBarcode.length }
        }
      }
    };
  }

  // 2. Check for Invalid Characters (now that length is confirmed to be 8 or 13)
  if (!/^\d+$/.test(cleanedBarcode)) {
    return { 
        ...baseResult, 
        barcodeType: determinedBarcodeType, 
        errorKey: 'barcodeInvalidChars', 
        digitMappings: {
            ...baseResult.digitMappings,
            'barcodeType': {
              indices: [],
              explanationKey: barcodeTypeExplanationKey,
              explanationContext: { length: cleanedBarcode.length }
            }
        }
    };
  }
  
  // 3. Validate EAN-13 check digit (if EAN-13)
  if (determinedBarcodeType === BarcodeType.EAN13_UPCA) {
    if (!isValidEan13CheckDigit(cleanedBarcode)) {
      return {
        ...baseResult,
        barcodeType: determinedBarcodeType,
        errorKey: 'barcodeInvalidCheckDigit',
        digitMappings: {
          ...baseResult.digitMappings,
          'barcodeType': {
            indices: [],
            explanationKey: barcodeTypeExplanationKey,
            explanationContext: { length: cleanedBarcode.length }
          }
        }
      };
    }
  }

  baseResult.barcodeType = determinedBarcodeType;
  if (baseResult.digitMappings) {
    baseResult.digitMappings['barcodeType'] = {
      indices: [],
      explanationKey: barcodeTypeExplanationKey,
      explanationContext: { length: cleanedBarcode.length }
    };
  }

  if (exceptions[cleanedBarcode] && !originalHeroBarcodes.has(cleanedBarcode)) {
    const exceptionData = exceptions[cleanedBarcode];
    return {
      ...baseResult,
      ...exceptionData,
      isValid: true,
      barcodeType: baseResult.barcodeType, // Preserve determined type
      digitMappings: { ...baseResult.digitMappings, ...exceptionData.digitMappings },
    } as ParsedBarcodeData;
  }

  let methodToUse: 1 | 2;
  let methodReasonKey: string;
  let methodReasonContext: Record<string, any> | undefined;
  let parsedMethodData: Partial<ParsedBarcodeData> = {};

  if (determinedBarcodeType === BarcodeType.EAN8) {
    methodToUse = 2;
    methodReasonKey = 'reasonMethod2Ean8';
    const paddedBarcode = '00000' + cleanedBarcode;
    parsedMethodData = parseMethod2(paddedBarcode, methodReasonKey, undefined, baseResult.digitMappings || {});
  } else { // EAN-13/UPC-A
    const A = safeParseInt(cleanedBarcode[0]);
    const C = safeParseInt(cleanedBarcode[2]);
    const J = safeParseInt(cleanedBarcode[9]);

    if (A > 2 && (C < 9 || J !== 5)) {
      methodToUse = 2;
      methodReasonKey = 'reasonMethod1Rejected';
      methodReasonContext = { A, C, J };
      parsedMethodData = parseMethod2(cleanedBarcode, methodReasonKey, methodReasonContext, baseResult.digitMappings || {});
    } else {
      methodToUse = 1;
      methodReasonKey = 'reasonMethod1Met';
      methodReasonContext = { A, C, J };
      parsedMethodData = parseMethod1(cleanedBarcode, methodReasonKey, methodReasonContext, baseResult.digitMappings || {});
    }
  }
  
  let finalData: ParsedBarcodeData = {
    ...baseResult,
    methodUsed: parsedMethodData.methodUsed || methodToUse,
    reasonKey: parsedMethodData.reasonKey || methodReasonKey,
    reasonContext: parsedMethodData.reasonContext || methodReasonContext,
    ...parsedMethodData,
    digitMappings: { ...baseResult.digitMappings, ...parsedMethodData.digitMappings },
  };

  if (originalHeroBarcodes.has(cleanedBarcode)) {
    const exceptionData = exceptions[cleanedBarcode];
    finalData = {
        ...finalData,
        ...exceptionData, // Override with hero specifics
        methodUsed: 'Exception',
        reasonKey: exceptionData.reasonKey,
        reasonContext: exceptionData.reasonContext,
        isValid: true, // Hero exceptions are valid
        digitMappings: { ...finalData.digitMappings, ...exceptionData.digitMappings }
    };
    if (finalData.stats) {
        finalData.flag = 50;
        finalData.isHero = true;
        const originalFlagIndices = finalData.digitMappings?.['flag']?.indices || [];
        finalData.digitMappings!['flag'] = {
            indices: originalFlagIndices,
            explanationKey: 'explanationFlagMethod2Hero', 
            explanationContext: { flag: 50, T: '?' } 
        };
        finalData.digitMappings!['isHero'] = {
            indices: [], 
            explanationKey: 'explanationIsHeroMethod2', 
            explanationContext: { isHero: true, T: '?' }
        };
    }
  }

  // --- Final Validity Check ---
  // If cardType is still Unknown AND it's not a special exception case, then it's invalid.
  if (finalData.cardType === CardType.Unknown && finalData.methodUsed !== 'Exception') {
    finalData.isValid = false;
    if (!finalData.errorKey) { // Don't overwrite a more specific error from a parsing method
        finalData.errorKey = 'barcodeError.UNKNOWN_GAME_ITEM'; // Keeping this as is for now
    }
    // If reasonKey is generic method determination, provide a more specific one for unknown item
    if (finalData.reasonKey === 'reasonMethod1Met' || finalData.reasonKey === 'reasonMethod1Rejected' || finalData.reasonKey === 'reasonMethod2Ean8') {
        finalData.reasonKey = 'reason.cardTypeDeterminationFailed';
        finalData.reasonContext = undefined; // Clear generic context
    }
  } else if (finalData.methodUsed !== 'Exception' && finalData.cardType !== CardType.Unknown) {
    // If a card type was found and it's not an exception, mark as valid.
    // This assumes parsing methods (Method1/2) don't set isValid:false if they return a cardType.
    // If they do, their isValid:false would be overridden here unless they also set cardType to Unknown.
    finalData.isValid = true; 
  }
  // If it's an 'Exception' methodUsed, isValid is determined by the exception data itself.

  // Ensure errorKey is cleared if ultimately valid
  if (finalData.isValid) {
    finalData.errorKey = undefined;
    finalData.errorContext = undefined;
  }

  return finalData;
}

// --- Method 1 Implementation (parseMethod1) ---
function parseMethod1(barcode: string, reasonKey: string, reasonContext: Record<string, any>, initialDigitMappings: Record<string, DigitMappingDetail>): Partial<ParsedBarcodeData> {
  const digitMappings: Record<string, DigitMappingDetail> = { ...initialDigitMappings };
  
  // Declare local variables for cardType and powerUpType using the enums
  let localCardType: CardType = CardType.Unknown;
  let localPowerUpType: PowerUpType | undefined = undefined;

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
  digitMappings['stats.hp'] = { indices: [0, 1, 2], explanationKey: 'explanationHpMethod1', explanationContext: { hp, A, B, C } };
  let baseSt = D * 1000 + E * 100;
  let baseDf = F * 1000 + G * 100;
  let st = baseSt;
  let df = baseDf;
  const stIndices = [3, 4]; // Mutable for H-based additions
  const dfIndices = [5, 6]; // Mutable for H-based additions
  digitMappings['stats.st'] = { indices: [...stIndices], explanationKey: 'explanationStBaseMethod1', explanationContext: { D, E } };
  digitMappings['stats.df'] = { indices: [...dfIndices], explanationKey: 'explanationDfBaseMethod1', explanationContext: { F, G } };
  const dx = J;
  digitMappings['stats.dx'] = { indices: [9], explanationKey: 'explanationDxMethod1', explanationContext: { dx, J } };
  const flag = K * 10 + L;
  digitMappings['flag'] = { indices: [10, 11], explanationKey: 'explanationFlagMethod1', explanationContext: { flag, K, L } };

  let stAddition = 0;
  let dfAddition = 0;
  let additionExplanationParts: string[] = [];
  if (A > 2) {
      if (H === 0 || H === 2) { stAddition = 10000; stIndices.push(7); additionExplanationParts.push(`H(${H}) is 0 or 2, add 10000 to ST.`); }
      if (H === 1 || H === 2) { dfAddition = 10000; dfIndices.push(7); additionExplanationParts.push(`H(${H}) is 1 or 2, add 10000 to DF.`); }
  }
  const additionExplanation = additionExplanationParts.join(' ');

  let race_val: number | undefined = undefined;
  let occupation_val: number | undefined = undefined;
  let isSingleUse_val: boolean | undefined = undefined;
  let pp_val: number | undefined = undefined;
  let mp_val: number | undefined = undefined;

  const cardTypeIndices = [7]; // Base index for card type determination
  let cardTypeExplanationKey = '';
  let cardTypeExplanationContext: Record<string, any> = { H, I };

  if (H >= 0 && H <= 4) { // Soldier or Wizard
    race_val = H; digitMappings['race'] = { indices: [7], explanationKey: 'explanationRaceMethod1', explanationContext: { race: race_val, H } };
    occupation_val = I; digitMappings['occupation'] = { indices: [8], explanationKey: 'explanationOccupationMethod1', explanationContext: { occupation: occupation_val, I } };
    localCardType = (I >= 7) ? CardType.Wizard : CardType.Soldier; // Use localCardType
    cardTypeIndices.push(8); cardTypeExplanationKey = 'explanationCardTypeMethod1Char'; cardTypeExplanationContext.cardType = localCardType;
    st += stAddition; df += dfAddition;
    digitMappings['stats.st'] = { indices: stIndices, explanationKey: 'explanationStMethod1Char', explanationContext: { st, baseSt, stAddition, A, additionExplanation, indices: stIndices.join(', ') } };
    digitMappings['stats.df'] = { indices: dfIndices, explanationKey: 'explanationDfMethod1Char', explanationContext: { df, baseDf, dfAddition, A, additionExplanation, indices: dfIndices.join(', ') } };
    pp_val = 5; digitMappings['stats.pp'] = { indices: [], explanationKey: 'explanationPpMethod1', explanationContext: { pp: pp_val } };
    mp_val = (I >= 6) ? 10 : 0; digitMappings['stats.mp'] = { indices: [8], explanationKey: 'explanationMpMethod1', explanationContext: { mp: mp_val, I } };
  } else if (H === 5 || H === 6) { // Weapon
    localCardType = CardType.Weapon; // Use localCardType
    occupation_val = I; digitMappings['occupation'] = { indices: [8], explanationKey: 'explanationOccupationMethod1', explanationContext: { occupation: occupation_val, I } };
    isSingleUse_val = (H === 5); digitMappings['isSingleUse'] = { indices: [7], explanationKey: 'explanationSingleUseMethod1', explanationContext: { isSingleUse: isSingleUse_val, H, value: 5 } };
    cardTypeExplanationKey = 'explanationCardTypeMethod1Weapon';  cardTypeExplanationContext.cardType = localCardType;
    st += stAddition; digitMappings['stats.st'] = { indices: stIndices, explanationKey: 'explanationStMethod1Weapon', explanationContext: { st, baseSt, stAddition, A, additionExplanation, indices: stIndices.join(', ') } };
    df = 0; digitMappings['stats.df'] = { indices: dfIndices, explanationKey: 'explanationDfMethod1Weapon', explanationContext: { baseDf: F * 1000 + G * 100 } }; // dfIndices might be misleading here as value is 0
    hp = 0; digitMappings['stats.hp']!.explanationKey = 'explanationHpMethod1WeaponArmour'; digitMappings['stats.hp']!.explanationContext = { cardType: 'Weapons', baseHp: A * 10000 + B * 1000 + C * 100 };
  } else if (H === 7 || H === 8) { // Armour
    localCardType = CardType.Armour; // Use localCardType
    occupation_val = I; digitMappings['occupation'] = { indices: [8], explanationKey: 'explanationOccupationMethod1', explanationContext: { occupation: occupation_val, I } };
    isSingleUse_val = (H === 7); digitMappings['isSingleUse'] = { indices: [7], explanationKey: 'explanationSingleUseMethod1', explanationContext: { isSingleUse: isSingleUse_val, H, value: 7 } };
    cardTypeExplanationKey = 'explanationCardTypeMethod1Armour'; cardTypeExplanationContext.cardType = localCardType;
    df += dfAddition; digitMappings['stats.df'] = { indices: dfIndices, explanationKey: 'explanationDfMethod1Armour', explanationContext: { df, baseDf, dfAddition, A, additionExplanation, indices: dfIndices.join(', ') } };
    st = 0; digitMappings['stats.st'] = { indices: stIndices, explanationKey: 'explanationStMethod1Armour', explanationContext: { baseSt: D * 1000 + E * 100 } }; // stIndices might be misleading
    hp = 0; digitMappings['stats.hp']!.explanationKey = 'explanationHpMethod1WeaponArmour'; digitMappings['stats.hp']!.explanationContext = { cardType: 'Armour', baseHp: A * 10000 + B * 1000 + C * 100 };
  } else if (H === 9) { // PowerUp
    localCardType = CardType.PowerUp; // Use localCardType
    cardTypeIndices.push(8); cardTypeExplanationKey = 'explanationCardTypeMethod1PowerUp'; cardTypeExplanationContext.I = I; cardTypeExplanationContext.cardType = localCardType;
    const baseHpPowerup = A * 10000 + B * 1000 + C * 100; const baseStPowerup = D * 1000 + E * 100; const baseDfPowerup = F * 1000 + G * 100;
    if (I >= 0 && I <= 4) { // Health
        localPowerUpType = PowerUpType.Health; st = 0; df = 0; // Use localPowerUpType
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1HealthPowerUp', explanationContext: { baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1HealthPowerUp', explanationContext: { baseDf: baseDfPowerup } };
    } else if (I === 5 || I === 6) { // News
        localPowerUpType = (I === 5) ? PowerUpType.VagueNews : PowerUpType.AccurateNews; hp = 0; st = 0; df = 0; // Use localPowerUpType
        digitMappings['stats.hp']!.explanationKey = 'explanationHpMethod1NewsPowerUp'; digitMappings['stats.hp']!.explanationContext = { baseHp: baseHpPowerup };
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1NewsPowerUp', explanationContext: { baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1NewsPowerUp', explanationContext: { baseDf: baseDfPowerup } };
    } else if (I === 7) { // Herb
        localPowerUpType = PowerUpType.Herb; pp_val = D * 100 + E; // Use localPowerUpType
        digitMappings['stats.pp'] = { indices: [3, 4], explanationKey: 'explanationPpMethod1Herb', explanationContext: { pp: pp_val, D, E } };
        hp = 0; st = 0; df = 0;
        digitMappings['stats.hp']!.explanationKey = 'explanationHpMethod1HerbPowerUp'; digitMappings['stats.hp']!.explanationContext = { baseHp: baseHpPowerup };
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1HerbPowerUp', explanationContext: { D, E, baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1HerbPowerUp', explanationContext: { baseDf: baseDfPowerup } };
    } else { // I = 8 or 9 (Magic)
        localPowerUpType = PowerUpType.Magic; mp_val = F * 100 + G; // Use localPowerUpType
        digitMappings['stats.mp'] = { indices: [5, 6], explanationKey: 'explanationMpMethod1Magic', explanationContext: { mp: mp_val, F, G } };
        hp = 0; st = 0; df = 0;
        digitMappings['stats.hp']!.explanationKey = 'explanationHpMethod1MagicPowerUp'; digitMappings['stats.hp']!.explanationContext = { baseHp: baseHpPowerup };
        digitMappings['stats.st'] = { indices: [3, 4], explanationKey: 'explanationStMethod1MagicPowerUp', explanationContext: { baseSt: baseStPowerup } };
        digitMappings['stats.df'] = { indices: [5, 6], explanationKey: 'explanationDfMethod1MagicPowerUp', explanationContext: { F, G, baseDf: baseDfPowerup } };
    }
    digitMappings['powerUpType'] = { indices: [8], explanationKey: 'explanationPowerUpTypeMethod1', explanationContext: { powerUpType: localPowerUpType, I } };
  }
  digitMappings['cardType'] = { indices: cardTypeIndices, explanationKey: cardTypeExplanationKey, explanationContext: cardTypeExplanationContext };
  const isHero_val = (flag === 19 || flag === 50) && hp < 6000 && st < 2000 && df < 2000;
  const heroCheckIndices = [ ...(digitMappings['flag']?.indices || []), ...(digitMappings['stats.hp']?.indices || []), ...(digitMappings['stats.st']?.indices || []), ...(digitMappings['stats.df']?.indices || []) ].filter((val, idx, self) => self.indexOf(val) === idx);
  digitMappings['isHero'] = { indices: heroCheckIndices, explanationKey: 'explanationIsHeroMethod1', explanationContext: { isHero: isHero_val, flag, hp, st, df, indices: heroCheckIndices.join(', ') } };
  const finalStats: any = { hp, st, df, dx };
  if (pp_val !== undefined) finalStats.pp = pp_val;
  if (mp_val !== undefined) finalStats.mp = mp_val;
  if (finalStats.hp < 0) finalStats.hp = 0;
  if (finalStats.st < 0) finalStats.st = 0;
  if (finalStats.df < 0) finalStats.df = 0;

  return {
    methodUsed: 1,
    reasonKey,
    reasonContext,
    cardType: localCardType, // Return the locally declared and assigned cardType
    stats: finalStats,
    race: race_val,
    occupation: occupation_val,
    flag,
    isHero: isHero_val,
    isSingleUse: isSingleUse_val,
    powerUpType: localPowerUpType, // Return the locally declared and assigned powerUpType
    digitMappings,
  };
}

// --- Method 2 Implementation (parseMethod2) ---
function parseMethod2(barcode: string, reasonKey: string, reasonContext: Record<string, any> | undefined, initialDigitMappings: Record<string, DigitMappingDetail>): Partial<ParsedBarcodeData> {
  const digitMappings: Record<string, DigitMappingDetail> = { ...initialDigitMappings };
  
  // Declare local variable for cardType using the enum
  let localCardType: CardType = CardType.Unknown;
  // PowerUpType is not explicitly determined in Method 2 like in Method 1, so no localPowerUpType needed here.

  const len = barcode.length;
  const pIdx = len - 6; const qIdx = len - 5; const rIdx = len - 4; const sIdx = len - 3; const tIdx = len - 2;
  const P = safeParseInt(barcode[pIdx]); const Q = safeParseInt(barcode[qIdx]); const R_val = safeParseInt(barcode[rIdx]); const S = safeParseInt(barcode[sIdx]); const T = safeParseInt(barcode[tIdx]); // Renamed R to R_val to avoid conflict
  let hp = 0; let st = 0; let df = 0; const dx = 0;
  digitMappings['stats.dx'] = { indices: [], explanationKey: 'explanationDxMethod2', explanationContext: { dx } };
  const cardTypeIndices = [tIdx];
  let flag_val = 10 * P + R_val;
  let flagExplanationKey = 'explanationFlagMethod2';
  let flagExplanationContext: Record<string, any> = { flag: flag_val, P, R: R_val, pIdx, rIdx: rIdx };
  const flagIndices = [pIdx, rIdx];
  const originalFlag = flag_val;
  if (flag_val > 29 && T >= 5) {
      flag_val = 0; flagExplanationKey = 'explanationFlagMethod2Adjusted'; // Corrected: Removed trailing backslash
      flagExplanationContext = { flag: flag_val, P, R: R_val, originalFlag, T, pIdx, rIdx: rIdx, tIdx };
      flagIndices.push(tIdx);
  }
  digitMappings['flag'] = { indices: flagIndices, explanationKey: flagExplanationKey, explanationContext: flagExplanationContext };
  let isHero_val = false;
  let isSingleUse_val: boolean | undefined = undefined;
  let cardTypeExplanationKey = '';
  let cardTypeExplanationContext: Record<string, any> = { T, tIdx };

  if (T < 5) { // Soldier or Wizard (Method 2 implies Hero)
    localCardType = CardType.Soldier; // Use localCardType. Method 2 doesn't distinguish Soldier/Wizard, defaults to Soldier for heroes.
    cardTypeExplanationKey = 'explanationCardTypeMethod2Hero'; cardTypeExplanationContext.cardType = localCardType;
    hp = (1000 * (10 * Math.floor(S / 2) + R_val)) + (100 * Q);
    digitMappings['stats.hp'] = { indices: [qIdx, rIdx, sIdx], explanationKey: 'explanationHpMethod2Hero', explanationContext: { hp, S, R: R_val, Q, qIdx, rIdx: rIdx, sIdx } };
    st = 1000 * ((R_val + 5) % 10 + 2) + 100 * ((Q + 5) % 10);
    digitMappings['stats.st'] = { indices: [qIdx, rIdx], explanationKey: 'explanationStMethod2Hero', explanationContext: { st, R: R_val, Q, qIdx, rIdx: rIdx } };
    df = 1000 * ((Q + 7) % 10) + 100 * ((P + 7) % 10);
    digitMappings['stats.df'] = { indices: [pIdx, qIdx], explanationKey: 'explanationDfMethod2Hero', explanationContext: { df, Q, P, pIdx, qIdx } };
    flag_val = 50;
    digitMappings['flag'] = { indices: [tIdx], explanationKey: 'explanationFlagMethod2Hero', explanationContext: { flag: flag_val, T, originalFlag, tIdx } };
    isHero_val = true;
    digitMappings['isHero'] = { indices: [tIdx], explanationKey: 'explanationIsHeroMethod2', explanationContext: { isHero: isHero_val, T, tIdx } };
  } else if (T === 5 || T === 6) { // Weapon
    localCardType = CardType.Weapon; // Use localCardType
    cardTypeExplanationKey = 'explanationCardTypeMethod2Weapon'; cardTypeExplanationContext.cardType = localCardType;
    st = 1000 * (1 + Math.floor(R_val / 4)) + 100 * ((Q + 5) % 10);
    digitMappings['stats.st'] = { indices: [qIdx, rIdx], explanationKey: 'explanationStMethod2Weapon', explanationContext: { st, R: R_val, Q, qIdx, rIdx: rIdx } };
    isSingleUse_val = (T === 5);
    digitMappings['isSingleUse'] = { indices: [tIdx], explanationKey: 'explanationSingleUseMethod2Weapon', explanationContext: { isSingleUse: isSingleUse_val, T, tIdx } };
    hp = 0; df = 0;
    digitMappings['stats.hp'] = { indices: [], explanationKey: 'explanationHpMethod2Weapon' };
    digitMappings['stats.df'] = { indices: [], explanationKey: 'explanationDfMethod2Weapon' };
  } else if (T === 7 || T === 8) { // Armour
    localCardType = CardType.Armour; // Use localCardType
    cardTypeExplanationKey = 'explanationCardTypeMethod2Armour'; cardTypeExplanationContext.cardType = localCardType;
    df = 1000 * Math.floor(Q / 4) + 100 * ((P + 7) % 10);
    digitMappings['stats.df'] = { indices: [pIdx, qIdx], explanationKey: 'explanationDfMethod2Armour', explanationContext: { df, Q, P, pIdx, qIdx } };
    isSingleUse_val = (T === 7);
    digitMappings['isSingleUse'] = { indices: [tIdx], explanationKey: 'explanationSingleUseMethod2Armour', explanationContext: { isSingleUse: isSingleUse_val, T, tIdx } };
    hp = 0; st = 0;
    digitMappings['stats.hp'] = { indices: [], explanationKey: 'explanationHpMethod2Armour' };
    digitMappings['stats.st'] = { indices: [], explanationKey: 'explanationStMethod2Armour' };
  } else { // T === 9 (PowerUp)
    localCardType = CardType.PowerUp; // Use localCardType
    cardTypeExplanationKey = 'explanationCardTypeMethod2PowerUp'; cardTypeExplanationContext.cardType = localCardType;
    hp = 0; st = 0; df = 0;
    digitMappings['stats.hp'] = { indices: [], explanationKey: 'explanationHpMethod2PowerUp' };
    digitMappings['stats.st'] = { indices: [], explanationKey: 'explanationStMethod2PowerUp' };
    digitMappings['stats.df'] = { indices: [], explanationKey: 'explanationDfMethod2PowerUp' };
  }
  digitMappings['cardType'] = { indices: cardTypeIndices, explanationKey: cardTypeExplanationKey, explanationContext: cardTypeExplanationContext };

  return {
    methodUsed: 2,
    reasonKey,
    reasonContext,
    cardType: localCardType, // Return the locally declared and assigned cardType
    stats: { hp, st, df, dx },
    flag: flag_val,
    isHero: isHero_val,
    isSingleUse: isSingleUse_val,
    digitMappings,
  };
}
