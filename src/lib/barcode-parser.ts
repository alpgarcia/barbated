/**
 * Details for mapping a parsed field back to the barcode digits.
 */
export interface DigitMappingDetail {
  indices: number[];
  explanation: string;
}

/**
 * Represents the parsed data from a Barcode Battler II barcode.
 */
export interface ParsedBarcodeData {
  barcode: string;
  isValid: boolean;
  error?: string;
  methodUsed?: 1 | 2 | 'Exception';
  reason?: string;
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
const exceptions: { [barcode: string]: ParsedBarcodeData } = {
  '4905040352507': { // Barcode Battler (Original Console)
    barcode: '4905040352507',
    isValid: true,
    methodUsed: 'Exception',
    reason: 'Epoch Product Barcode (Barcode Battler Console)',
    cardType: 'Soldier', // Based on equivalent barcode
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
    reason: 'Epoch Product Barcode (Barcode Battler II Console)',
    cardType: 'Wizard', // Based on equivalent barcode
    stats: { hp: 5200, st: 1500, df: 100, dx: 7, pp: 5, mp: 10 },
    race: 1,
    occupation: 8,
    flag: 50,
    isHero: true,
  },
  // --- Original Heroes (Recognized as Flag 50 in C1/C2) ---
  // Note: These stats are based on Method 1, but the flag is overridden.
  // We'll parse them normally first, then apply the exception override.
  '0120401154185': { barcode: '0120401154185', isValid: true, methodUsed: 'Exception', reason: 'Original Hero Backward Compatibility (Rarman)' },
  '0120201044181': { barcode: '0120201044181', isValid: true, methodUsed: 'Exception', reason: 'Original Hero Backward Compatibility (U-Ronchan)' },
  '0120102308184': { barcode: '0120102308184', isValid: true, methodUsed: 'Exception', reason: 'Original Hero Backward Compatibility (Bon-Curry)' },
  '0150604154187': { barcode: '0150604154187', isValid: true, methodUsed: 'Exception', reason: 'Original Hero Backward Compatibility (Cha-Han)' },
  '0180506308180': { barcode: '0180506308180', isValid: true, methodUsed: 'Exception', reason: 'Original Hero Backward Compatibility (Meatman)' },
};

const originalHeroBarcodes = new Set(Object.keys(exceptions).filter(bc => exceptions[bc].reason?.includes('Original Hero')));

/**
 * Parses a Barcode Battler II barcode string.
 * @param barcode The 13-digit UPC-A/EAN-13 or 8-digit EAN-8 barcode string.
 * @returns ParsedBarcodeData object.
 */
export function parseBarcode(barcode: string): ParsedBarcodeData {
  const cleanedBarcode = barcode.replace(/\s+/g, ''); // Remove spaces if any
  const baseResult: ParsedBarcodeData = { barcode: cleanedBarcode, isValid: false };

  // --- Basic Validation ---
  if (!/^\d+$/.test(cleanedBarcode)) {
    return { ...baseResult, error: 'Barcode must contain only digits.' };
  }
  if (cleanedBarcode.length !== 13 && cleanedBarcode.length !== 8) {
    return { ...baseResult, error: 'Barcode must be 8 (EAN-8) or 13 (UPC-A/EAN-13) digits long.' };
  }

  // --- Check for Hardcoded Exceptions ---
  if (exceptions[cleanedBarcode] && !originalHeroBarcodes.has(cleanedBarcode)) {
      // Return pre-defined Epoch product data directly
      return { ...exceptions[cleanedBarcode], isValid: true };
  }

  let methodUsed: 1 | 2;
  let reason: string;
  let parsedData: Partial<ParsedBarcodeData> = {};

  // --- Determine Method ---
  if (cleanedBarcode.length === 8) {
    methodUsed = 2;
    reason = 'EAN-8 barcode always uses Method 2.';
    // Pad EAN-8 to 13 digits with leading zeros for consistent indexing? Or handle differently?
    // For now, assume Method 2 logic directly uses the last digits.
    // Let's treat it like a 13-digit code ending in the 8 EAN-8 digits for simplicity of PQRSTU extraction.
    const paddedBarcode = '00000' + cleanedBarcode;
    parsedData = parseMethod2(paddedBarcode, reason);
  } else { // 13 digits (UPC-A / EAN-13)
    const A = safeParseInt(cleanedBarcode[0]);
    const C = safeParseInt(cleanedBarcode[2]);
    const J = safeParseInt(cleanedBarcode[9]);

    // Method 1 Rejection Condition Check
    if (A > 2 && (C < 9 || J !== 5)) {
      methodUsed = 2;
      reason = `Method 1 rejected: A (${A}) > 2 AND (C (${C}) < 9 OR J (${J}) != 5). Using Method 2.`;
      parsedData = parseMethod2(cleanedBarcode, reason);
    } else {
      methodUsed = 1;
      reason = 'Method 1 criteria met.';
      parsedData = parseMethod1(cleanedBarcode, reason);
    }
  }

  // --- Apply Original Hero Exception Override ---
  if (originalHeroBarcodes.has(cleanedBarcode)) {
      parsedData.methodUsed = 'Exception';
      parsedData.reason = exceptions[cleanedBarcode].reason;
      // Override the flag calculated by Method 1
      if (parsedData.stats) { // Ensure stats were parsed
          parsedData.flag = 50;
          parsedData.isHero = true;
      }
  }

  return {
    ...baseResult, // Includes original barcode
    isValid: true,
    methodUsed: parsedData.methodUsed || methodUsed, // Use override if present
    reason: parsedData.reason || reason, // Use override if present
    ...parsedData, // Add the parsed stats, type, etc.
  };
}

// --- Method 1 Implementation ---
function parseMethod1(barcode: string, reason: string): Partial<ParsedBarcodeData> {
  const digitMappings: Record<string, DigitMappingDetail> = {};

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
    indices: [0, 1, 2], // A, B, C
    explanation: `HP (${hp}) = A(${A})*10000 + B(${B})*1000 + C(${C})*100. Digits: [0, 1, 2].`
  };

  // Initial ST/DF values and indices
  let st = D * 1000 + E * 100;
  const stIndices = [3, 4]; // D, E
  let stExplanation = `Base ST = D(${D})*1000 + E(${E})*100.`; // Base explanation

  let df = F * 1000 + G * 100;
  const dfIndices = [5, 6]; // F, G
  let dfExplanation = `Base DF = F(${F})*1000 + G(${G})*100.`; // Base explanation

  // Create initial ST/DF mappings here
  digitMappings['stats.st'] = { indices: [...stIndices], explanation: stExplanation };
  digitMappings['stats.df'] = { indices: [...dfIndices], explanation: dfExplanation };

  // Assign DX mapping immediately
  const dx = J;
  digitMappings['stats.dx'] = {
    indices: [9], // J
    explanation: `DX/Speed (${dx}) = J(${J}). Digit: [9].`
  };

  // Assign Flag mapping immediately
  const flag = K * 10 + L;
  digitMappings['flag'] = {
    indices: [10, 11], // K, L
    explanation: `Flag (${flag}) = K(${K})*10 + L(${L}). Digits: [10, 11].`
  };

  // Calculate additions
  let stAddition = 0;
  let dfAddition = 0;
  let additionExplanation = '';
  if (A > 2) {
      additionExplanation = ` Since A(${A}) > 2:`;
      if (H === 0 || H === 2) {
          stAddition = 10000;
          stIndices.push(7); // H affects ST
          additionExplanation += ` H(${H}) is 0 or 2, add 10000 to ST.`;
      }
      if (H === 1 || H === 2) {
          dfAddition = 10000;
          dfIndices.push(7); // H affects DF
          additionExplanation += ` H(${H}) is 1 or 2, add 10000 to DF.`;
      }
  }

  let cardType: ParsedBarcodeData['cardType'] = 'Unknown';
  let race: number | undefined = undefined;
  let occupation: number | undefined = undefined;
  let isSingleUse: boolean | undefined = undefined;
  let powerUpType: ParsedBarcodeData['powerUpType'] = undefined;
  let pp: number | undefined = undefined;
  let mp: number | undefined = undefined;

  const cardTypeIndices = [7]; // Primarily determined by H
  let cardTypeExplanation = `Card type determined by H(${H}).`;

  if (H >= 0 && H <= 4) { // Soldier or Wizard
    race = H;
    digitMappings['race'] = {
      indices: [7], // H
      explanation: `Race (${race}) = H(${H}). Digit: [7].`
    };
    occupation = I;
    digitMappings['occupation'] = {
      indices: [8], // I
      explanation: `Occupation (${occupation}) = I(${I}). Digit: [8].`
    };
    cardType = (I >= 7) ? 'Wizard' : 'Soldier';
    cardTypeIndices.push(8); // I also determines Wizard/Soldier
    cardTypeExplanation += ` Since H is 0-4, it's a Character. I(${I}) >= 7 makes it a ${cardType}. Digits: [7, 8].`;

    // Apply additions and finalize ST/DF explanations and mappings for Characters
    st += stAddition;
    df += dfAddition;
    stExplanation = `ST (${st}) = (Base D(${D})*1000 + E(${E})*100) + ${stAddition}${additionExplanation}. Digits: [${stIndices.join(', ')}].`;
    dfExplanation = `DF (${df}) = (Base F(${F})*1000 + G(${G})*100) + ${dfAddition}${additionExplanation}. Digits: [${dfIndices.join(', ')}].`;
    digitMappings['stats.st'] = { indices: stIndices, explanation: stExplanation };
    digitMappings['stats.df'] = { indices: dfIndices, explanation: dfExplanation };

    pp = 5;
    digitMappings['stats.pp'] = {
      indices: [], // Fixed value for Method 1 Characters
      explanation: `PP (${pp}) is fixed at 5 for Method 1 Characters.`
    };
    mp = (I >= 6) ? 10 : 0;
    digitMappings['stats.mp'] = {
      indices: [8], // I determines MP
      explanation: `MP (${mp}) = I(${I}) >= 6 ? 10 : 0. Digit: [8].`
    };

  } else if (H === 5 || H === 6) { // Weapon
    cardType = 'Weapon';
    occupation = I;
    digitMappings['occupation'] = {
      indices: [8], // I
      explanation: `Occupation (${occupation}) = I(${I}). Digit: [8].`
    };
    isSingleUse = (H === 5);
    digitMappings['isSingleUse'] = {
      indices: [7], // H
      explanation: `Single Use (${isSingleUse}) = H(${H}) === 5. Digit: [7].`
    };
    cardTypeExplanation += ` Since H is 5 or 6, it's a Weapon. Digits: [7].`;

    // Apply additions and finalize ST explanation and mapping for Weapons
    st += stAddition;
    stExplanation = `ST (${st}) = (Base D(${D})*1000 + E(${E})*100) + ${stAddition}${additionExplanation}. Digits: [${stIndices.join(', ')}].`;
    digitMappings['stats.st'] = { indices: stIndices, explanation: stExplanation };

    // Update DF explanation to indicate not applicable
    df = 0;
    dfExplanation = `DF (0) is not applicable for Weapons. Base was F(${F})*1000 + G(${G})*100.`;
    digitMappings['stats.df'] = { indices: dfIndices, explanation: dfExplanation }; // Update existing

    hp = 0; // Set HP to 0 for Weapon
    // Update HP explanation
    digitMappings['stats.hp'].explanation = `HP (0) is not applicable for Weapons. Base was A(${A})*10000 + B(${B})*1000 + C(${C})*100.`;

  } else if (H === 7 || H === 8) { // Armour
    cardType = 'Armour';
    occupation = I;
    digitMappings['occupation'] = {
      indices: [8], // I
      explanation: `Occupation (${occupation}) = I(${I}). Digit: [8].`
    };
    isSingleUse = (H === 7);
    digitMappings['isSingleUse'] = {
      indices: [7], // H
      explanation: `Single Use (${isSingleUse}) = H(${H}) === 7. Digit: [7].`
    };
    cardTypeExplanation += ` Since H is 7 or 8, it's an Armour. Digits: [7].`;

    // Apply additions and finalize DF explanation and mapping for Armour
    df += dfAddition;
    dfExplanation = `DF (${df}) = (Base F(${F})*1000 + G(${G})*100) + ${dfAddition}${additionExplanation}. Digits: [${dfIndices.join(', ')}].`;
    digitMappings['stats.df'] = { indices: dfIndices, explanation: dfExplanation };

    // Update ST explanation to indicate not applicable
    st = 0;
    stExplanation = `ST (0) is not applicable for Armour. Base was D(${D})*1000 + E(${E})*100.`;
    digitMappings['stats.st'] = { indices: stIndices, explanation: stExplanation }; // Update existing

    hp = 0; // Set HP to 0 for Armour
    // Update HP explanation
    digitMappings['stats.hp'].explanation = `HP (0) is not applicable for Armour. Base was A(${A})*10000 + B(${B})*1000 + C(${C})*100.`;

  } else if (H === 9) { // Power-Up
    cardType = 'PowerUp';
    // Initial explanation part
    cardTypeExplanation = ` Since H(${H}) is 9, it's a PowerUp.`;
    cardTypeIndices.push(8); // I determines the specific type

    // Determine PowerUp type based on I
    if (I >= 0 && I <= 4) { // Health
        powerUpType = 'Health';
        // HP calculation for Health PowerUp (Method 1) - uses original HP mapping
        st = 0; df = 0;
        // Update explanations for ST/DF
        stExplanation = `ST (0) is not applicable for Health PowerUp. Base was D(${D})*1000 + E(${E})*100.`;
        dfExplanation = `DF (0) is not applicable for Health PowerUp. Base was F(${F})*1000 + G(${G})*100.`;
        digitMappings['stats.st'] = { indices: [3, 4], explanation: stExplanation }; // Update existing
        digitMappings['stats.df'] = { indices: [5, 6], explanation: dfExplanation }; // Update existing

    } else if (I === 5 || I === 6) { // News
        powerUpType = (I === 5) ? 'VagueNews' : 'AccurateNews';
        hp = 0; st = 0; df = 0;
        // Update explanations for HP/ST/DF
        digitMappings['stats.hp'].explanation = `HP (0) is not applicable for News PowerUp. Base was A(${A})*10000 + B(${B})*1000 + C(${C})*100.`;
        stExplanation = `ST (0) is not applicable for News PowerUp. Base was D(${D})*1000 + E(${E})*100.`;
        dfExplanation = `DF (0) is not applicable for News PowerUp. Base was F(${F})*1000 + G(${G})*100.`;
        digitMappings['stats.st'] = { indices: [3, 4], explanation: stExplanation }; // Update existing
        digitMappings['stats.df'] = { indices: [5, 6], explanation: dfExplanation }; // Update existing

    } else if (I === 7) { // Herb
        powerUpType = 'Herb';
        pp = D * 100 + E; // PP from D, E
        digitMappings['stats.pp'] = {
            indices: [3, 4], // D, E
            explanation: `Herb PP (${pp}) = D(${D})*100 + E(${E}). Digits: [3, 4].`
        };
        hp = 0; st = 0; df = 0;
        // Update explanations for HP/ST/DF
        digitMappings['stats.hp'].explanation = `HP (0) is not applicable for Herb PowerUp. Base was A(${A})*10000 + B(${B})*1000 + C(${C})*100.`;
        // ST is used for PP, so keep its original explanation but note it's not ST stat
        stExplanation = `Digits D(${D}), E(${E}) used for PP in Herb PowerUp. Base ST calc was D*1000 + E*100.`;
        dfExplanation = `DF (0) is not applicable for Herb PowerUp. Base was F(${F})*1000 + G(${G})*100.`;
        digitMappings['stats.st'] = { indices: [3, 4], explanation: stExplanation }; // Update existing
        digitMappings['stats.df'] = { indices: [5, 6], explanation: dfExplanation }; // Update existing

    } else { // I = 8 or 9 (Magic)
        powerUpType = 'Magic';
        mp = F * 100 + G; // MP from F, G
        digitMappings['stats.mp'] = {
            indices: [5, 6], // F, G
            explanation: `Magic MP (${mp}) = F(${F})*100 + G(${G}). Digits: [5, 6].`
        };
        hp = 0; st = 0; df = 0;
        // Update explanations for HP/ST/DF
        digitMappings['stats.hp'].explanation = `HP (0) is not applicable for Magic PowerUp. Base was A(${A})*10000 + B(${B})*1000 + C(${C})*100.`;
        stExplanation = `ST (0) is not applicable for Magic PowerUp. Base was D(${D})*1000 + E(${E})*100.`;
        // DF is used for MP, so keep its original explanation but note it's not DF stat
        dfExplanation = `Digits F(${F}), G(${G}) used for MP in Magic PowerUp. Base DF calc was F*1000 + G*100.`;
        digitMappings['stats.st'] = { indices: [3, 4], explanation: stExplanation }; // Update existing
        digitMappings['stats.df'] = { indices: [5, 6], explanation: dfExplanation }; // Update existing
    }
    digitMappings['powerUpType'] = {
        indices: [8], // Determined by I
        explanation: `PowerUp Type (${powerUpType}) determined by I(${I}). Digit: [8].`
    };
  }

  // Final Card Type mapping update (now includes specific PowerUp type in explanation)
  digitMappings['cardType'] = { indices: cardTypeIndices, explanation: cardTypeExplanation };

  // Final isHero check and mapping
  const isHero = (flag === 19 || flag === 50) && hp < 6000 && st < 2000 && df < 2000;
  const heroCheckIndices = [
      ...(digitMappings['flag']?.indices || []),
      ...(digitMappings['stats.hp']?.indices || []),
      ...(digitMappings['stats.st']?.indices || []),
      ...(digitMappings['stats.df']?.indices || []),
  ].filter((val, idx, self) => self.indexOf(val) === idx); // Unique indices

  digitMappings['isHero'] = {
      indices: heroCheckIndices,
      explanation: `Is Hero (${isHero}) = (Flag(${flag}) is 19 or 50) AND HP(${hp}) < 6000 AND ST(${st}) < 2000 AND DF(${df}) < 2000. Checked Digits: [${heroCheckIndices.join(', ')}].`
  };

  // Clean up stats object: remove undefined values
  const finalStats: any = { hp, st, df, dx };
  if (pp !== undefined) finalStats.pp = pp;
  if (mp !== undefined) finalStats.mp = mp;
  // Ensure stats are not negative
  if (finalStats.hp < 0) finalStats.hp = 0;
  if (finalStats.st < 0) finalStats.st = 0;
  if (finalStats.df < 0) finalStats.df = 0;

  return {
    methodUsed: 1,
    reason,
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

// --- Method 2 Implementation ---
function parseMethod2(barcode: string, reason: string): Partial<ParsedBarcodeData> {
  const digitMappings: Record<string, DigitMappingDetail> = {};
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

  digitMappings['stats.dx'] = {
    indices: [],
    explanation: `DX/Speed (${dx}) is always 0 in Method 2.`
  };

  const cardTypeIndices = [tIdx]; // T
  let cardType: ParsedBarcodeData['cardType'] = 'Unknown';

  let flag = 10 * P + R;
  let flagExplanation = `Flag (${flag}) = P(${P})*10 + R(${R}). Digits: [${pIdx}, ${rIdx}].`;
  const flagIndices = [pIdx, rIdx];

  if (flag > 29 && T >= 5) {
      const originalFlag = flag;
      flag = 0;
      flagExplanation += ` Adjusted to 0 because original flag (${originalFlag}) > 29 and T(${T}) >= 5. Digit T: [${tIdx}].`;
      flagIndices.push(tIdx);
  }
  digitMappings['flag'] = { indices: flagIndices, explanation: flagExplanation };

  let isHero = false;
  let isSingleUse: boolean | undefined = undefined;
  let powerUpType: ParsedBarcodeData['powerUpType'] = undefined;
  let cardTypeExplanation = `Card type determined by T(${T}). Digit: [${tIdx}].`;

  if (T < 5) { // Soldier or Wizard (Method 2 implies Hero)
    cardType = 'Soldier';
    cardTypeExplanation += ` Since T < 5, it's a Character (Hero).`;

    hp = (1000 * (10 * Math.floor(S / 2) + R)) + (100 * Q);
    digitMappings['stats.hp'] = {
      indices: [qIdx, rIdx, sIdx], // Q, R, S
      explanation: `HP (${hp}) = (1000 * (10 * floor(S(${S})/2) + R(${R}))) + (100 * Q(${Q})). Digits: [${qIdx}, ${rIdx}, ${sIdx}].`
    };
    st = 1000 * ((R + 5) % 10 + 2) + 100 * ((Q + 5) % 10);
    digitMappings['stats.st'] = {
      indices: [qIdx, rIdx], // Q, R
      explanation: `ST (${st}) = 1000 * ((R(${R}) + 5) % 10 + 2) + 100 * ((Q(${Q}) + 5) % 10). Digits: [${qIdx}, ${rIdx}].`
    };
    df = 1000 * ((Q + 7) % 10) + 100 * ((P + 7) % 10);
    digitMappings['stats.df'] = {
      indices: [pIdx, qIdx], // P, Q
      explanation: `DF (${df}) = 1000 * ((Q(${Q}) + 7) % 10) + 100 * ((P(${P}) + 7) % 10). Digits: [${pIdx}, ${qIdx}].`
    };

    const originalFlag = flag;
    flag = 50;
    digitMappings['flag'] = {
        indices: [tIdx], // T determines it's a hero
        explanation: `Flag (${flag}) is set to 50 because T(${T}) < 5 (Method 2 Hero). Original calculated flag was ${originalFlag}. Digit: [${tIdx}].`
    };
    isHero = true;
    digitMappings['isHero'] = {
        indices: [tIdx],
        explanation: `Is Hero (${isHero}) is true because T(${T}) < 5. Digit: [${tIdx}].`
    };

  } else if (T === 5 || T === 6) { // Weapon
    cardType = 'Weapon';
    cardTypeExplanation += ` Since T is 5 or 6, it's a Weapon.`;
    st = 1000 * (1 + Math.floor(R / 4)) + 100 * ((Q + 5) % 10);
    digitMappings['stats.st'] = {
      indices: [qIdx, rIdx], // Q, R
      explanation: `ST (${st}) = 1000 * (1 + floor(R(${R}) / 4)) + 100 * ((Q(${Q}) + 5) % 10). Digits: [${qIdx}, ${rIdx}].`
    };
    isSingleUse = (T === 5);
    digitMappings['isSingleUse'] = {
      indices: [tIdx], // T
      explanation: `Single Use (${isSingleUse}) = T(${T}) === 5. Digit: [${tIdx}].`
    };
    hp = 0; df = 0;
    // Update HP/DF explanations
    digitMappings['stats.hp'] = { indices: [], explanation: `HP (0) is not applicable for Method 2 Weapons.` };
    digitMappings['stats.df'] = { indices: [], explanation: `DF (0) is not applicable for Method 2 Weapons.` };

  } else if (T === 7 || T === 8) { // Armour
    cardType = 'Armour';
    cardTypeExplanation += ` Since T is 7 or 8, it's an Armour.`;
    df = 1000 * Math.floor(Q / 4) + 100 * ((P + 7) % 10);
    digitMappings['stats.df'] = {
      indices: [pIdx, qIdx], // P, Q
      explanation: `DF (${df}) = 1000 * floor(Q(${Q}) / 4) + 100 * ((P(${P}) + 7) % 10). Digits: [${pIdx}, ${qIdx}].`
    };
    isSingleUse = (T === 7);
    digitMappings['isSingleUse'] = {
      indices: [tIdx], // T
      explanation: `Single Use (${isSingleUse}) = T(${T}) === 7. Digit: [${tIdx}].`
    };
    hp = 0; st = 0;
    // Update HP/ST explanations
    digitMappings['stats.hp'] = { indices: [], explanation: `HP (0) is not applicable for Method 2 Armour.` };
    digitMappings['stats.st'] = { indices: [], explanation: `ST (0) is not applicable for Method 2 Armour.` };

  } else if (T > 8) { // Health Power-Up (Method 2 only has Health)
    cardType = 'PowerUp';
    powerUpType = 'Health';
    cardTypeExplanation += ` Since T > 8, it's a Health PowerUp.`;
    digitMappings['powerUpType'] = {
        indices: [tIdx],
        explanation: `PowerUp Type (${powerUpType}) is Health because T(${T}) > 8. Digit: [${tIdx}].`
    };
    hp = 10000 * Math.floor(S / 8) + 1000 * R + 100 * Q;
    digitMappings['stats.hp'] = {
      indices: [qIdx, rIdx, sIdx], // Q, R, S
      explanation: `PowerUp HP (${hp}) = 10000 * floor(S(${S}) / 8) + 1000 * R(${R}) + 100 * Q(${Q}). Digits: [${qIdx}, ${rIdx}, ${sIdx}].`
    };
    st = 0; df = 0;
    // Update ST/DF explanations
    digitMappings['stats.st'] = { indices: [], explanation: `ST (0) is not applicable for Method 2 PowerUps.` };
    digitMappings['stats.df'] = { indices: [], explanation: `DF (0) is not applicable for Method 2 PowerUps.` };
  }

  digitMappings['cardType'] = { indices: cardTypeIndices, explanation: cardTypeExplanation };

  return {
    methodUsed: 2,
    reason,
    cardType,
    stats: { hp, st, df, dx }, // dx is always 0
    flag,
    isHero,
    isSingleUse,
    powerUpType,
    digitMappings,
  };
}
