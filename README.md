# AI True Nesting for Adobe Illustrator (Version 0.1 BETA)

Professional nesting solution for Adobe Illustrator that uses irregular shapes (True Nesting) to maximize material usage on roll media and sheets.

## Compatibility
- **Operating System:** Windows 10/11 (Standalone binary included).
- **macOS:** Not currently supported in Version 0.1 BETA (macOS version is under development).
- **Adobe Illustrator:** CC 2020 or newer recommended.

## Features
- **True Nesting (High Precision):** Uses actual object geometry instead of simple bounding boxes.
- **Roll Media Optimization:** Two specialized "gravity" strategies:
    - **Minimize Roll Length (Y-priority):** Packs items tightly towards the top to save length.
    - **Minimize Roll Width (X-priority):** Packs items tightly towards the side to save width.
- **High-Performance Engine:** Powered by a spatial indexing engine (`STRtree`) for lightning-fast collision detection.
- **Automatic Rotation:** Tests 0, 90, 180, and 270-degree rotations for the best possible fit.
- **Smart Fallback:** Automatically switches to optimized box-packing if an irregular shape cannot be nested.

## Installation
1. Download the **AI-True-Nesting-v0.1-BETA.zip** from the releases page.
2. Extract the ZIP file on your computer.
3. Move the following to your Illustrator Scripts folder:
    - `IllustratorTrueNesting.jsx`
    - `pynesting/` (This entire folder must be kept together with the script)
   
   *Typical path for Scripts (Windows):*  
   `C:\Program Files\Adobe\Adobe Illustrator [Version]\Presets\en_US\Scripts`

4. Restart Adobe Illustrator.

## How to Use
1. Select the objects you want to nest in your active document.
2. Go to `File > Scripts > IllustratorTrueNesting`.
3. Configure your settings:
    - **Spacing:** Minimum distance between objects (in pixels).
    - **Filling Strategy:** Choose how you want to prioritize material savings.
    - **High Precision:** Keep checked for True Nesting (Irregular shapes).
4. Click **Start Nesting**.

## Troubleshooting
- **Permissions:** Ensure you have write access to your Windows Temp folder.
- **Logs:** If nesting fails, a detailed log is available at `%TEMP%\ai_nesting\log.txt`.
- **Locked Layers:** Ensure all selected objects are on unlocked and visible layers.
