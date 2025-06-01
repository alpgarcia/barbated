export interface SavedCardState {
  barcode: string;
  cardName?: string;
  cardDescription?: string;
  customImageBase64?: string;
}

// Re-export ParsedBarcodeData if it's defined elsewhere and used with SavedCardState implicitly
// Or ensure ParsedBarcodeData is imported where SavedCardState is used if they are related
// For now, assuming ParsedBarcodeData is globally available or imported in App.tsx
