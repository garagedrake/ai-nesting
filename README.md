# AI True Nesting for Adobe Illustrator

Professional nesting solution that uses irregular shapes (True Nesting) to maximize material usage.

## Features
- **True Nesting (High Precision):** Uses the actual geometry of objects instead of bounding boxes.
- **High-Performance Engine:** Powered by Python with `Shapely` and `STRtree` for lightning-fast collision detection.
- **Rotation Support:** Automatically tests 0, 90, 180, and 270 degree rotations for optimal fit.
- **Smart Fallback:** If an irregular shape can't be nested, it falls back to efficient box-packing to ensure all items are placed.
- **Artboard Aware:** Automatically detects artboard dimensions and keeps all items within bounds.

## Requirements
- **Adobe Illustrator**
- **Python 3.x**
- **Python Libraries:**
  ```bash
  pip install shapely svgelements
  ```

## Installation
1. Clone the repository or download the files.
2. Install the required Python libraries (see above).
3. In Illustrator, go to `File > Scripts > Other Script...` and select `IllustratorTrueNesting.jsx`.

## How to Use
1. Select the objects you want to nest in Illustrator.
2. Run the script.
3. Set the **Mellanrum (Spacing)** in pixels.
4. Check **Hög precision (True Nesting)** for irregular shapes.
5. Click **Starta Nesting**.

## Troubleshooting
- If the nesting doesn't start, check `%TEMP%\ai_nesting\log.txt` for detailed engine logs.
- Ensure all selected objects are on unlocked layers.

## Version
Current Version: 0.1 (BETA)
