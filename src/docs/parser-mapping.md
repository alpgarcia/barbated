# Barcode Parser: Digit Mapping to ParsedBarcodeData

## Introduction

This document explains how the `barcode-parser.ts` module interprets the digits of a Barcode Battler II barcode (UPC-A, EAN-13, EAN-8) and maps them to the fields of the `ParsedBarcodeData` interface. It complements the main `card-system.md` document by focusing specifically on the parser's output structure.

The parser now also identifies the barcode type (`EAN-8` or `EAN-13/UPC-A`) and provides detailed explanations for how each field was derived using translation keys (`explanationKey`) and context (`explanationContext`) within the `digitMappings` field. Error messages and method choice reasons also use this key/context system for internationalization.

Refer to `card-system.md` for the detailed conversion algorithms (Method 1 and Method 2) and flag descriptions.

## The `ParsedBarcodeData` Interface

The parser returns an object conforming to this structure:

```typescript
/**
 * Details for mapping a parsed field back to the barcode digits.
 */
export interface DigitMappingDetail {
  indices: number[]; // Which 0-based digit indices were used
  explanationKey: string; // Key for translation lookup
  explanationContext?: Record<string, any>; // Context for interpolation
}

/**
 * Represents the parsed data from a Barcode Battler II barcode.
 */
export interface ParsedBarcodeData {
  barcode: string;       // The original (cleaned) barcode string
  barcodeType?: 'EAN-8' | 'EAN-13/UPC-A' | 'Unknown'; // Detected barcode type
  isValid: boolean;      // Was the barcode valid and parseable?
  errorKey?: string;     // Translation key for error message if isValid is false
  errorContext?: Record<string, any>; // Context for error message interpolation
  methodUsed?: 1 | 2 | 'Exception'; // Which parsing method was used?
  reasonKey?: string;    // Translation key for method choice or exception reason
  reasonContext?: Record<string, any>; // Context for reason interpolation
  cardType?: 'Soldier' | 'Wizard' | 'Weapon' | 'Armour' | 'PowerUp' | 'Unknown';
  stats?: {
    hp: number;
    st: number;
    df: number;
    dx: number;         // Digit J (Called 'speed' in barcode-battler-engine)
    pp?: number;        // Power Points
    mp?: number;        // Magic Points
  };
  race?: number;         // 0: Mech, 1: Animal, 2: Oceanic, 3: Bird, 4: Human
  occupation?: number;   // 0-9
  flag?: number;         // 0-99 (Special ability code)
  isHero?: boolean;      // Is the card considered a Hero?
  isSingleUse?: boolean; // Applies to Weapons/Armour
  powerUpType?: 'Health' | 'Herb' | 'Magic' | 'VagueNews' | 'AccurateNews'; // If cardType is PowerUp
  digitMappings?: Record<string, DigitMappingDetail>; // Map field names to source digit indices and explanation details
}
```

## Mapping by Method

The following sections describe the *logic* for mapping digits to stats. The actual parser output includes a `digitMappings` field which provides a detailed breakdown for *each specific barcode parsed*, including the exact digit indices used and an explanation key/context.

### Method 1 (Applies to specific UPC-A/EAN-13)

Let the 13 digits be `ABCDEFGHIJKLM`.

*   **`barcodeType`**: Set to `'EAN-13/UPC-A'`.
*   **`stats.hp`**: Calculated from `A`, `B`, `C` (`A*10k + B*1k + C*100`).
    *   Note: For Weapons and Armour, the parser sets HP to 0 after initial calculation.
*   **`stats.st`**: Base value from `D`, `E` (`D*1k + E*100`).
    *   `+10000` if `A > 2` AND (`H == 0` OR `H == 2`).
    *   Set to 0 for Armour and PowerUps.
*   **`stats.df`**: Base value from `F`, `G` (`F*1k + G*100`).
    *   `+10000` if `A > 2` AND (`H == 1` OR `H == 2`).
    *   Set to 0 for Weapons and PowerUps.
*   **`stats.dx`**: Directly from `J`. (Corresponds to 'speed' in barcode-battler-engine).
*   **`stats.pp`**: Set to `5` if `cardType` is 'Soldier' or 'Wizard'. Otherwise `undefined`.
*   **`stats.mp`**: Set to `10` if `cardType` is 'Wizard' OR (`cardType` is 'Soldier' AND `occupation` is 6 or higher). Otherwise `0` for Soldiers/Wizards, and `undefined` for other types. (Based on `I >= 6`).
*   **`flag`**: Calculated from `K`, `L` (`K*10 + L`).
*   **`cardType`, `race`, `isSingleUse` (Determined by `H`):**
    *   `H = 0`: `cardType` is 'Soldier'/'Wizard', `race` is `0` (Mech Tribe).
    *   `H = 1`: `cardType` is 'Soldier'/'Wizard', `race` is `1` (Animal Tribe).
    *   `H = 2`: `cardType` is 'Soldier'/'Wizard', `race` is `2` (Oceanic Tribe).
    *   `H = 3`: `cardType` is 'Soldier'/'Wizard', `race` is `3` (Bird Tribe).
    *   `H = 4`: `cardType` is 'Soldier'/'Wizard', `race` is `4` (Human Tribe).
    *   `H = 5`: `cardType` is 'Weapon', `isSingleUse` is `true` (Single Use Weapon), `race` is `undefined`.
    *   `H = 6`: `cardType` is 'Weapon', `isSingleUse` is `false` (Durable Weapon), `race` is `undefined`.
    *   `H = 7`: `cardType` is 'Armour', `isSingleUse` is `true` (Single Use Armour), `race` is `undefined`.
    *   `H = 8`: `cardType` is 'Armour', `isSingleUse` is `false` (Durable Armour), `race` is `undefined`.
    *   `H = 9`: `cardType` is 'PowerUp', `isSingleUse` is `undefined`, `race` is `undefined`.
*   **`occupation`, `powerUpType`, Soldier/Wizard Distinction (Determined by `I`):**
    *   If `H = 0-4` (Warrior):
        *   `occupation` is `I`.
        *   `cardType` becomes 'Wizard' if `I >= 7`, otherwise 'Soldier'.
        *   `stats.mp` becomes `10` if `I >= 6`, otherwise `0`.
        *   `stats.pp` becomes `5`.
    *   If `H = 5-8` (Weapon/Armour):
        *   `occupation` is `I`.
    *   If `H = 9` (PowerUp):
        *   `occupation` is `undefined`.
        *   `powerUpType` determined by `I`: `0-4`='Health', `5`='VagueNews', `6`='AccurateNews', `7`='Herb', `8-9`='Magic'.
        *   For 'Herb', `stats.pp` is calculated from `D`, `E` (`D*100 + E`).
        *   For 'Magic', `stats.mp` is calculated from `F`, `G` (`F*100 + G`).
*   **`isHero`**: `true` if (`flag` is 19 or 50) AND stat limits (HP<6k, ST<2k, DF<2k) are met. Otherwise `false`.

### Method 2 (Applies to EAN-8 and rejected UPC-A/EAN-13)

Let the last 6 digits of the (potentially padded) barcode be `PQRSTU`. The parser currently returns the **Enemy/C0 stats**.

*   **`barcodeType`**: Set to `'EAN-8'` or `'EAN-13/UPC-A'` depending on original length.
*   **`cardType`, `isSingleUse` (Determined by `T`):**
    *   `T < 5`: `cardType` is 'Soldier' (Wizard distinction not implemented; defaults to Soldier).
    *   `T = 5`: `cardType` is 'Weapon', `isSingleUse` is `true` (Single Use Weapon).
    *   `T = 6`: `cardType` is 'Weapon', `isSingleUse` is `false` (Durable Weapon).
    *   `T = 7`: `cardType` is 'Armour', `isSingleUse` is `true` (Single Use Armour).
    *   `T = 8`: `cardType` is 'Armour', `isSingleUse` is `false` (Durable Armour).
    *   `T > 8`: `cardType` is 'PowerUp', `powerUpType` is 'Health'.
*   **`stats.hp`, `stats.st`, `stats.df`**: Calculated using formulas based on `P`, `Q`, `R`, `S`, `T` specific to the `cardType` (see `card-system.md` or parser code for C0 formulas). Set to 0 if not applicable.
*   **`stats.dx`**: Always `0` (mapping unknown).
*   **`stats.pp`**: `undefined` (mapping unknown).
*   **`stats.mp`**: `undefined` (mapping unknown).
*   **`flag`**: Calculated from `P`, `R` (`10*P + R`).
    *   If `T < 5` (potential Hero), `flag` is overridden to `50`.
    *   If `T >= 5` and `10*P + R > 29`, `flag` is treated as `0`.
*   **`isHero`**: `true` if `T < 5`, otherwise `false` (effect ignored).
*   **`race`**: `undefined` (mapping unknown).
*   **`occupation`**: `undefined` (mapping unknown).
*   **`powerUpType`**: Only set to 'Health' if `T > 8`.

## Exceptions

*   **Epoch Products** (e.g., `4905040352507`):
    *   `methodUsed` is 'Exception'.
    *   `reasonKey` is set (e.g., `'reasonExceptionEpoch'`) with context (`reasonContext`).
    *   All other fields (`cardType`, `stats`, etc.) are set to predefined values.
*   **Original Heroes** (e.g., `0120401154185` - Rarman):
    *   Initially parsed using **Method 1**.
    *   `methodUsed` is overridden to 'Exception'.
    *   `reasonKey` is set (e.g., `'reasonExceptionOriginalHero'`) with context (`reasonContext`).
    *   `flag` is overridden to `50`.
    *   `isHero` is overridden to `true`.
    *   Other fields retain their Method 1 values.
    *   `digitMappings` will reflect the initial Method 1 calculation, but the override for `flag` and `isHero` will have specific explanation keys.
