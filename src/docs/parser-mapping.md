# Barcode Parser: Digit Mapping to ParsedBarcodeData

## Introduction

This document explains how the `barcode-parser.ts` module interprets the digits of a Barcode Battler II barcode (UPC-A, EAN-13, EAN-8) and maps them to the fields of the `ParsedBarcodeData` interface. It complements the main `card-system.md` document by focusing specifically on the parser's output structure.

Refer to `card-system.md` for the detailed conversion algorithms (Method 1 and Method 2) and flag descriptions.

## The `ParsedBarcodeData` Interface

The parser returns an object conforming to this structure:

```typescript
export interface ParsedBarcodeData {
  barcode: string;       // The original (cleaned) barcode string
  isValid: boolean;      // Was the barcode valid and parseable?
  error?: string;        // Error message if isValid is false
  methodUsed?: 1 | 2 | 'Exception'; // Which parsing method was used?
  reason?: string;       // Explanation for method choice or exception
  cardType?: 'Soldier' | 'Wizard' | 'Weapon' | 'Armour' | 'PowerUp' | 'Unknown';
  stats?: {
    hp: number;
    st: number;
    df: number;
    dx: number;         // Digit J (Called 'speed' in barcode-battler-engine)
    pp?: number;        // Power Points (Set to 5 for Method 1 Fighters based on barcode-battler-engine)
    mp?: number;        // Magic Points (Set to 10 if I>=6 for Method 1 Fighters based on barcode-battler-engine)
  };
  race?: number;         // 0-4 (Only for Warriors - Method 1)
  occupation?: number;   // 0-9 (Mainly for Warriors/Items - Method 1)
  flag?: number;         // 0-99 (Special ability code)
  isHero?: boolean;      // Is the card considered a Hero?
  isSingleUse?: boolean; // Applies to Weapons/Armour
  powerUpType?: 'Health' | 'Herb' | 'Magic' | 'VagueNews' | 'AccurateNews'; // If cardType is PowerUp
}
```

## Mapping by Method

### Method 1 (Applies to specific UPC-A/EAN-13)

Let the 13 digits be `ABCDEFGHIJKLM`.

*   **`stats.hp`**: Calculated from `A`, `B`, `C` (`A*10k + B*1k + C*100`).
    *   Note: For Weapons and Armour, the parser sets HP to 0 after initial calculation.
*   **`stats.st`**: Base value from `D`, `E` (`D*1k + E*100`).
    *   `+10000` if `A > 2` AND (`H == 0` OR `H == 2`).
    *   Set to 0 for Armour and PowerUps.
*   **`stats.df`**: Base value from `F`, `G` (`F*1k + G*100`).
    *   `+10000` if `A > 2` AND (`H == 1` OR `H == 2`).
    *   Set to 0 for Weapons and PowerUps.
*   **`stats.dx`**: Directly from `J`. (Corresponds to 'speed' in barcode-battler-engine).
*   **`stats.pp`**: Set to `5` if `cardType` is 'Soldier' or 'Wizard'. Otherwise `undefined`. (Based on barcode-battler-engine logic).
*   **`stats.mp`**: Set to `10` if `cardType` is 'Wizard' OR (`cardType` is 'Soldier' AND `occupation` is 6). Otherwise `0` for Soldiers/Wizards, and `undefined` for other types. (Based on barcode-battler-engine logic where `mp=10` if `I >= 6`).
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
        *   `stats.pp` and `stats.mp` are `undefined`.
    *   If `H = 9` (PowerUp):
        *   `occupation` is `undefined`.
        *   `powerUpType` determined by `I`:
            *   `I < 5`: 'Health'
            *   `I = 5`: 'VagueNews'
            *   `I = 6`: 'AccurateNews'
            *   `I = 7`: 'Herb' (Note: barcode-battler-engine calculates PP from D,E here)
            *   `I > 7`: 'Magic' (Note: barcode-battler-engine calculates MP from F,G here)
        *   `stats.pp` and `stats.mp` are `undefined` (by our current parser logic).
*   **`isHero`**: `true` if (`flag` is 19 or 50) AND stat limits (HP<6k, ST<2k, DF<2k) are met. Otherwise `false`.

### Method 2 (Applies to EAN-8 and rejected UPC-A/EAN-13)

Let the last 6 digits be `PQRSTU`.
The parser currently returns the **Enemy/C0 stats**.

*   **`cardType`, `isSingleUse` (Determined by `T`):**
    *   `T < 5`: `cardType` is 'Soldier' (Wizard distinction not implemented; defaults to Soldier).
    *   `T = 5`: `cardType` is 'Weapon', `isSingleUse` is `true` (Single Use Weapon).
    *   `T = 6`: `cardType` is 'Weapon', `isSingleUse` is `false` (Durable Weapon).
    *   `T = 7`: `cardType` is 'Armour', `isSingleUse` is `true` (Single Use Armour).
    *   `T = 8`: `cardType` is 'Armour', `isSingleUse` is `false` (Durable Armour).
    *   `T > 8`: `cardType` is 'PowerUp', `powerUpType` is 'Health'.
*   **`stats.hp`, `stats.st`, `stats.df`**: Calculated using formulas based on `P`, `Q`, `R`, `S`, `T` specific to the `cardType` (see `card-system.md` or parser code for C0 formulas). Set to 0 if not applicable (e.g., ST/DF for Health PowerUp).
*   **`stats.dx`**: Currently always `0` (mapping unknown).
*   **`stats.pp`**: Currently `undefined` (mapping unknown).
*   **`stats.mp`**: Currently `undefined` (mapping unknown).
*   **`flag`**: Calculated from `P`, `R` (`10*P + R`).
    *   If `T < 5` (potential Hero), `flag` is overridden to `50`.
    *   If `T >= 5` and `10*P + R > 29`, `flag` is treated as `0` (effect ignored).
*   **`isHero`**: `true` if `T < 5`, otherwise `false`.
*   **`race`**: `undefined` (mapping unknown).
*   **`occupation`**: `undefined` (mapping unknown).
*   **`powerUpType`**: Only set to 'Health' if `T > 8`.

## Exceptions

*   **Epoch Products** (e.g., `4905040352507`):
    *   `methodUsed` is 'Exception'.
    *   All other fields (`cardType`, `stats`, `race`, `occupation`, `flag`, `isHero`) are set to predefined values based on the specific barcode.
*   **Original Heroes** (e.g., `0120401154185` - Rarman):
    *   Initially parsed using **Method 1**.
    *   `methodUsed` is then overridden to 'Exception'.
    *   `reason` indicates backward compatibility.
    *   `flag` is overridden to `50`.
    *   `isHero` is overridden to `true`.
    *   All other fields retain their values from the initial Method 1 parsing.
