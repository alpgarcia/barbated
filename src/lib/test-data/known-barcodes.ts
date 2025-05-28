import { ParsedBarcodeData, CardType } from '../barcode-parser'; // Added CardType import

// Define helper to create expected data structure easily
// Allow a subset of ParsedBarcodeData fields for defining expectations.
type ExpectedData = Partial<Omit<ParsedBarcodeData, 'barcode' | 'isValid' | 'digitMappings'>>;

export const testBarcodes: { barcode: string; expected: ExpectedData }[] = [
  // --- Method 1 Examples ---
  {
    barcode: '0401207336501', // Rarman-CP (Soldier, Method 1)
    expected: {
      methodUsed: 1,
      cardType: CardType.Soldier, // Used CardType enum
      stats: { hp: 4000, st: 1200, df: 700, dx: 6, pp: 5, mp: 0 }, // J=6, PP=5 (Fighter), MP=0 (I=3 < 6)
      race: 3, // H=3 -> Bird Tribe
      occupation: 3, // I=3 (Occupation Digit, <7 -> Soldier)
      flag: 50, // K=5, L=0
      isHero: true, // Flag 50 and stats within limits
      isSingleUse: undefined,
      powerUpType: undefined,
    },
  },
  {
    barcode: '0340912373503', // VMD-Kurif (Wizard, Method 1)
    expected: {
      methodUsed: 1,
      cardType: CardType.Wizard, // Used CardType enum
      stats: { hp: 3400, st: 900, df: 1200, dx: 3, pp: 5, mp: 10 }, // J=3, PP=5 (Fighter), MP=10 (I=7 >= 6)
      race: 3, // H=3 -> Bird Tribe
      occupation: 7, // I=7 (Occupation Digit, >=7 -> Wizard)
      flag: 50, // K=5, L=0
      isHero: true, // Flag 50 and stats within limits
      isSingleUse: undefined,
      powerUpType: undefined,
    },
  },
   {
    barcode: '0000400603238', // NJ-Sword (Weapon, Method 1) - Assuming H=6 for Durable Weapon
    expected: {
      methodUsed: 1,
      cardType: CardType.Weapon, // Used CardType enum
      stats: { hp: 0, st: 400, df: 0, dx: 3, pp: undefined, mp: undefined }, // J=3, No PP/MP for items
      race: undefined, // Weapons don't have race? Or is it H? H=6 (Durable Weapon)
      occupation: 0, // I=0 (Occupation Digit)
      flag: 23, // K=2, L=3
      isHero: false,
      isSingleUse: false, // H=6 -> Durable
      powerUpType: undefined,
    },
  },
   {
    barcode: '0000007801143', // CN-Armor (Armour, Method 1) - Assuming H=8 for Durable Armour
    expected: {
      methodUsed: 1,
      cardType: CardType.Armour, // Used CardType enum
      stats: { hp: 0, st: 0, df: 700, dx: 1, pp: undefined, mp: undefined }, // J=1, No PP/MP for items
      race: undefined, // H=8 (Durable Armour)
      occupation: 0, // I=0 (Occupation Digit)
      flag: 14, // K=1, L=4
      isHero: false,
      isSingleUse: false, // H=8 -> Durable
      powerUpType: undefined,
    },
  },
  {
    barcode: '0000018703382', // HP-Glass -> Actually Armour based on H=8
     expected: {
      methodUsed: 1,
      cardType: CardType.Armour, // Corrected: H=8 is Armour // Used CardType enum
      stats: { hp: 0, st: 0, df: 1800, dx: 3, pp: undefined, mp: undefined }, // Corrected stats for Armour (DF=F*1k+G*100=1800, DX=J=3, No PP/MP for items)
      race: undefined, // H=8 (Single Use Armour)
      occupation: 0, // I=0 (Occupation Digit)
      flag: 38, // K=3, L=8
      isHero: false,
      isSingleUse: true, // H=8 -> Single Use
      powerUpType: undefined, // Not a PowerUp
    },
  },
  // Example with I=6 (ST_SOLDIER): Grenzer (bottom barcode)
  // https://cards.bimbiribase.xyz/barcodebattler/5af14fac-0a97-4336-9708-8fdafb1ec788/
  {
    barcode: '2096175365189', // Soldier with I=6 (ST_SOLDIER_6)
    expected: {
      methodUsed: 1,
      cardType: CardType.Soldier, // Used CardType enum
      stats: { hp: 20900, st: 6100, df: 7500, dx: 5, pp: 5, mp: 10 }, // J=5, PP=5 (Fighter), MP=10 (I=6 >= 6)
      race: 3, // Corrected: H=3 -> Bird Tribe
      occupation: 6, // I=6 (Occupation Digit)
      flag: 18, // Corrected: K=1, L=8 -> 18
      isHero: false, // Corrected: Flag 18 is not a Hero flag
      isSingleUse: undefined,
      powerUpType: undefined,
    },
  },
  // Added DARMAN
  // https://cards.bimbiribase.xyz/barcodebattler/d5a753fb-e71b-4fc4-ae0a-94d203649b7c/
  {
    barcode: '1315661065749', // DARMAN
    expected: {
      methodUsed: 1,
      cardType: CardType.Soldier, // I=6 // Used CardType enum
      stats: { hp: 13100, st: 5600, df: 6100, dx: 5, pp: 5, mp: 10 },
      race: 0, // H=0 -> Mech Tribe
      occupation: 6, // I=6
      flag: 74, // K=7, L=4
      isHero: false, // Flag 74
      isSingleUse: undefined,
      powerUpType: undefined,
    },
  },
  // Added DACRONE
  // https://cards.bimbiribase.xyz/barcodebattler/48bc5a1b-f526-4318-8402-d7e446f68e51/
  {
    barcode: '1784984166189', // DACRONE
    expected: {
      methodUsed: 1,
      cardType: CardType.Soldier, // I=6 // Used CardType enum
      stats: { hp: 17800, st: 4900, df: 8400, dx: 6, pp: 5, mp: 10 },
      race: 1, // H=1 -> Animal Tribe
      occupation: 6, // I=6
      flag: 18, // K=1, L=8
      isHero: false, // Flag 18
      isSingleUse: undefined,
      powerUpType: undefined,
    },
  },

  // --- Method 2 Trigger Example (Violates Method 1) ---
  {
    // Barcode: 308...4XX (A=3, C=8, J=4) - Using last 6 digits 123456 for PQRSTU
    barcode: '3080000004123456', // Invalid 16-digit barcode
    expected: {
      // Corrected: Expect validation error using errorKey
      errorKey: 'barcodeInvalidLength'
    },
  },

  // --- EAN-8 Example ---
  {
    // Using last 6 digits 123456 for PQRSTU, T=8 -> Health PowerUp
    barcode: '00123456',
    expected: {
      methodUsed: 2,
      cardType: CardType.Weapon, // Used CardType enum
      stats: { hp: 0, st: 1700, df: 0, dx: 0, pp: undefined, mp: undefined }, // No PP/MP defined for Method 2 yet
      race: undefined,
      occupation: undefined, // Method 2 doesn't define occupation
      flag: 13, // 10*P + R = 13
      isHero: false,
      isSingleUse: true, // T=5
      powerUpType: undefined,
    },
  },

  // --- Exception Examples ---
  {
    barcode: '4905040352507', // Barcode Battler Console
    expected: {
      methodUsed: 'Exception',
      cardType: CardType.Soldier, // Used CardType enum
      stats: { hp: 5200, st: 1500, df: 100, dx: 6, pp: 5, mp: 0 },
      race: 1, // Predefined: Animal Tribe
      occupation: 0, // Predefined: Occupation 0
      flag: 50,
      isHero: true,
    },
  },
  {
    barcode: '0120401154185', // Rarman (Original Hero Exception)
    expected: {
      methodUsed: 'Exception', // Overridden
      cardType: CardType.Soldier, // H=1 -> Animal, I=5 -> Soldier // Used CardType enum
      stats: { hp: 1200, st: 400, df: 100, dx: 4, pp: 5, mp: 0 }, // J=4, PP=5 (Fighter), MP=0 (I=5 < 6)
      race: 1, // H=1
      occupation: 5, // I=5 (Occupation Digit)
      flag: 50, // Overridden by exception
      isHero: true, // Because flag is 50
      isSingleUse: undefined,
      powerUpType: undefined,
    },
  },

  // --- Invalid Examples ---
  {
    barcode: '12345',
    expected: { errorKey: 'barcodeInvalidLength' },
  },
  {
    barcode: 'ABCDEFGHIJKLM',
    expected: { errorKey: 'barcodeInvalidChars' },
  },
];
