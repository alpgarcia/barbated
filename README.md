# Barbated - Barcode Battler II Editor

This project contains a TypeScript implementation for parsing barcodes according to the card system rules of Barcode Battler II (European version).

## Acknowledgements
This project is based on the information in the [Barcode Battler Museum](https://barcodebattler.co.uk/) and the [Barcode Battler Engine project](https://github.com/VITIMan/barcode-battler-engine). Many thanks and all the credit to the contributors of these projects for their work in reverse engineering the card system and providing valuable insights into the game mechanics.

The project has been created using LLMs and is not affiliated with the original Barcode Battler II game or its developers.

## License
This project is licensed under the GPL v3.0 License. See the [LICENSE](LICENSE) file for details.

## Project Structure

*   `src/`: Contains the main source code for the library.
    *   `lib/`: The parsing library code and test data.
    *   `docs/`: Detailed documentation about the card system and parser mapping.
*   `jest.config.js`: Configuration for the Jest testing framework.
*   `package.json`: Defines project dependencies and scripts (like the test script).
*   `tsconfig.json`: TypeScript compiler configuration.

## Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Run tests:**
    ```bash
    npm test
    ```
3.  **Run the application locally:**
    ```bash
    npm run dev
    ```
    This will start the Vite development server, and you can access the application in your browser at the URL provided (usually `http://localhost:5173`).

## Contribution

(Section to be completed if external contributions are planned)
