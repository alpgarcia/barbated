# Barcode Parser: Digit Mapping to ParsedBarcodeData

## Introduction

This document explains how the `barcode-parser.ts` module interprets the digits of a Barcode Battler II barcode (UPC-A, EAN-13, EAN-8) and maps them to the fields of the `ParsedBarcodeData` interface. It complements the main `card-system.md` document by focusing specifically on the parser\'s output structure.

The parser now utilizes TypeScript enums for `BarcodeType`, `CardType`, and `PowerUpType` for better type safety and clarity. It also identifies the barcode type (`BarcodeType.EAN8` or `BarcodeType.EAN13_UPCA`) and provides detailed explanations for how each field was derived using translation keys (`explanationKey`) and context (`explanationContext`) within the `digitMappings` field. Error messages and method choice reasons also use this key/context system for internationalization.

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

// TypeScript Enums used in ParsedBarcodeData
export enum BarcodeType {
  EAN8 = \'EAN-8\',
  EAN13_UPCA = \'EAN-13/UPC-A\',
  Unknown = \'Unknown\'
}

export enum CardType {
  Soldier = \'Soldier\',
  Wizard = \'Wizard\',
  Weapon = \'Weapon\',
  Armour = \'Armour\',
  PowerUp = \'PowerUp\',
  Unknown = \'Unknown\'
}

export enum PowerUpType {
  Health = \'Health\',
  Herb = \'Herb\',
  Magic = \'Magic\',
  VagueNews = \'VagueNews\',
  AccurateNews = \'AccurateNews\'
}

export type MethodUsedType = 1 | 2 | \'Exception\' | undefined;

/**
 * Represents the parsed data from a Barcode Battler II barcode.
 */
export interface ParsedBarcodeData {
  barcode: string;       // The original (cleaned) barcode string
  barcodeType?: BarcodeType; // Detected barcode type using BarcodeType enum
  isValid: boolean;      // Was the barcode valid and parseable?
  errorKey?: string;     // Translation key for error message if isValid is false
  errorContext?: Record<string, any>; // Context for error message interpolation
  methodUsed?: MethodUsedType; // Which parsing method was used? (1, 2, 'Exception', or undefined)
  reasonKey?: string;    // Translation key for method choice or exception reason
  reasonContext?: Record<string, any>; // Context for reason interpolation
  cardType?: CardType;   // Detected card type using CardType enum
  stats?: {
    hp: number;
    st: number;
    df: number;
    dx: number;         // Digit J (Called \'speed\' in barcode-battler-engine)
    pp?: number;        // Power Points
    mp?: number;        // Magic Points
  };
  race?: number;         // 0: Mech, 1: Animal, 2: Oceanic, 3: Bird, 4: Human
  occupation?: number;   // 0-9
  flag?: number;         // 0-99 (Special ability code)
  isHero?: boolean;      // Is the card considered a Hero?
  isSingleUse?: boolean; // Applies to Weapons/Armour
  powerUpType?: PowerUpType; // If cardType is PowerUp, uses PowerUpType enum
  digitMappings?: Record<string, DigitMappingDetail>; // Map field names to source digit indices and explanation details
  rawDump?: string;      // The original barcode string as received by the parser (before cleaning)
  parsedDigits?: number[]; // Array of numbers representing the digits of the cleaned barcode
  // Other fields like isPsuedoBarcode, comments, checkDigit, countryCode, etc., exist but are not primary to game stat mapping.
}
```

## Mapping by Method

The following sections describe the *logic* for mapping digits to stats. The actual parser output includes a `digitMappings` field which provides a detailed breakdown for *each specific barcode parsed*, including the exact digit indices used and an explanation key/context.

### Method 1 (Applies to specific UPC-A/EAN-13)

Let the 13 digits be `ABCDEFGHIJKLM`.

*   **`barcodeType`**: Set to `BarcodeType.EAN13_UPCA`.
*   **`stats.hp`**: Calculated from `A`, `B`, `C` (`A*10k + B*1k + C*100`).
    *   Note: For Weapons and Armour, the parser sets HP to 0 after initial calculation.
*   **`stats.st`**: Base value from `D`, `E` (`D*1k + E*100`).
    *   `+10000` if `A > 2` AND (`H == 0` OR `H == 2`).
    *   Set to 0 for Armour and PowerUps (except specific PowerUp types).
*   **`stats.df`**: Base value from `F`, `G` (`F*1k + G*100`).
    *   `+10000` if `A > 2` AND (`H == 1` OR `H == 2`).
    *   Set to 0 for Weapons and PowerUps (except specific PowerUp types).
*   **`stats.dx`**: Directly from `J`. (Corresponds to \'speed\' in barcode-battler-engine).
*   **`stats.pp`**: Set to `5` if `cardType` is `CardType.Soldier` or `CardType.Wizard`. Otherwise `undefined`. (For `PowerUpType.Herb`, PP is calculated differently).
*   **`stats.mp`**: Set to `10` if `cardType` is `CardType.Wizard`, or if `cardType` is `CardType.Soldier` and `occupation >= 6`. Otherwise `0` for `CardType.Soldier` with `occupation < 6`. `undefined` for other types. (Based on `I >= 6` for Warriors). (For `PowerUpType.Magic`, MP is calculated differently).
*   **`flag`**: Calculated from `K`, `L` (`K*10 + L`).
*   **`cardType`, `race`, `isSingleUse` (Determined by `H`):**
    *   `H = 0`: `cardType` is `CardType.Soldier`/\`Wizard\`, `race` is `0` (Mech Tribe).
    *   `H = 1`: `cardType` is `CardType.Soldier`/\`Wizard\`, `race` is `1` (Animal Tribe).
    *   `H = 2`: `cardType` is `CardType.Soldier`/\`Wizard\`, `race` is `2` (Oceanic Tribe).
    *   `H = 3`: `cardType` is `CardType.Soldier`/\`Wizard\`, `race` is `3` (Bird Tribe).
    *   `H = 4`: `cardType` is `CardType.Soldier`/\`Wizard\`, `race` is `4` (Human Tribe).
    *   `H = 5`: `cardType` is `CardType.Weapon`, `isSingleUse` is `true` (Single Use Weapon), `race` is `undefined`.
    *   `H = 6`: `cardType` is `CardType.Weapon`, `isSingleUse` is `false` (Durable Weapon), `race` is `undefined`.
    *   `H = 7`: `cardType` is `CardType.Armour`, `isSingleUse` is `true` (Single Use Armour), `race` is `undefined`.
    *   `H = 8`: `cardType` is `CardType.Armour`, `isSingleUse` is `false` (Durable Armour), `race` is `undefined`.
    *   `H = 9`: `cardType` is `CardType.PowerUp`, `isSingleUse` is `undefined`, `race` is `undefined`.
*   **`occupation`, `powerUpType`, Soldier/Wizard Distinction (Determined by `I`):**
    *   If `H = 0-4` (Warrior type determined by H):
        *   `occupation` is `I`.
        *   `cardType` becomes `CardType.Wizard` if `I >= 7`, otherwise it remains `CardType.Soldier`.
        *   `stats.mp` becomes `10` if `I >= 6`, otherwise `0`.
        *   `stats.pp` becomes `5`.
    *   If `H = 5-8` (Weapon/Armour):
        *   `occupation` is `I`.
    *   If `H = 9` (`CardType.PowerUp`):
        *   `occupation` is `undefined`.
        *   `powerUpType` determined by `I`: `0-4`=`PowerUpType.Health`, `5`=`PowerUpType.VagueNews`, `6`=`PowerUpType.AccurateNews`, `7`=`PowerUpType.Herb`, `8-9`=`PowerUpType.Magic`.
        *   For `PowerUpType.Herb`, `stats.pp` is calculated from `D`, `E` (`D*100 + E`). HP, ST, DF set to 0.
        *   For `PowerUpType.Magic`, `stats.mp` is calculated from `F`, `G` (`F*100 + G`). HP, ST, DF set to 0.
        *   For `PowerUpType.Health`, HP is from A,B,C. ST, DF set to 0.
        *   For `PowerUpType.VagueNews` or `PowerUpType.AccurateNews`, HP, ST, DF set to 0.
*   **`isHero`**: `true` if (`flag` is 19 or 50) AND stat limits (HP<6k, ST<2k, DF<2k) are met. Otherwise `false`.

### Method 2 (Applies to EAN-8 and rejected UPC-A/EAN-13)

For EAN-8, the 8-digit barcode is padded with five leading zeros (`00000` + EAN-8) to form a 13-digit string for consistent indexing. Let the last 6 digits of the (potentially padded) barcode be `PQRSTU` (corresponding to indices `len-6` to `len-1`). The parser currently returns the **Enemy/C0 stats**.

*   **`barcodeType`**: Set to `BarcodeType.EAN8` or `BarcodeType.EAN13_UPCA` depending on original length.
*   **`cardType`, `isSingleUse` (Determined by `T` - digit at index `len-2`):**
    *   `T < 5`: `cardType` is `CardType.Soldier` (Wizard distinction not made, defaults to Soldier).
    *   `T = 5`: `cardType` is `CardType.Weapon`, `isSingleUse` is `true` (Single use weapon).
    *   `T = 6`: `cardType` is `CardType.Weapon`, `isSingleUse` is `false` (Durable weapon).
    *   `T = 7`: `cardType` is `CardType.Armour`, `isSingleUse` is `true` (Single use armour).
    *   `T = 8`: `cardType` is `CardType.Armour`, `isSingleUse` is `false` (Durable armour).
    *   `T > 8` (i.e. `T = 9`): `cardType` is `CardType.PowerUp`.
*   **`stats.hp`, `stats.st`, `stats.df`**: Calculated using formulas based on `P`, `Q`, `R_val`, `S`, `T` specific to the `cardType` (see `card-system.md` or parser code for C0 formulas). Set to 0 if not applicable (e.g., HP for Weapon/Armour/PowerUp, ST/DF for PowerUp).
*   **`stats.dx`**: Always `0` (mapping unknown/not applicable for Method 2).
*   **`stats.pp`**: `undefined` (mapping unknown/not applicable for Method 2).
*   **`stats.mp`**: `undefined` (mapping unknown/not applicable for Method 2).
*   **`flag`**: Calculated from `P`, `R_val` (`10*P + R_val`).
    *   If `T < 5` (potential Hero, i.e., `CardType.Soldier`), `flag` is overridden to `50`.
    *   If `T >= 5` and `10*P + R_val > 29`, `flag` is treated as `0`.
*   **`isHero`**: `true` if `T < 5` (i.e. `CardType.Soldier`), otherwise `false`.
*   **`race`**: `undefined` (mapping unknown/not applicable for Method 2).
*   **`occupation`**: `undefined` (mapping unknown/not applicable for Method 2).
*   **`powerUpType`**: If `cardType` is `CardType.PowerUp` (i.e. `T > 8`), it defaults to `PowerUpType.Health`. Other PowerUp types are not determined by Method 2.

## Exceptions

*   **Epoch Products** (e.g., `4905040352507` - Barcode Battler Console):
    *   `methodUsed` is `'Exception'`.
    *   `reasonKey` is set (e.g., `'reasonExceptionEpoch'`).
    *   `reasonContext` provides details (e.g., `{ productName: 'Barcode Battler Console' }`).
    *   All other fields (`cardType`, `stats`, etc.) are set to predefined values (e.g., `CardType.Soldier`, HP 5200, ST 1500, etc.).
*   **Original Heroes** (e.g., `0120401154185` - Rarman):
    *   Initially parsed using **Method 1** if criteria met.
    *   `methodUsed` is overridden to `'Exception'`.
    *   `reasonKey` is set (e.g., `'reasonExceptionOriginalHero'`).
    *   `reasonContext` provides details (e.g., `{ heroName: 'Rarman' }`).
    *   `flag` is overridden to `50`.
    *   `isHero` is overridden to `true`.
    *   Other fields generally retain their Method 1 values, but specific exception data for the hero might override some stats or card type.
    *   `digitMappings` will reflect the initial Method 1 calculation for most fields, but the overrides for `flag` and `isHero` (and potentially others) will have specific explanation keys indicating they are due to the "Original Hero" exception.
