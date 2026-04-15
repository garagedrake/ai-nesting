# Adobe Illustrator Nesting Script

An Adobe Illustrator script (ExtendScript) for box-nesting selected objects within the active artboard.

## Features
- **Artboard-aware**: Automatically detects the size of the active artboard.
- **Unit Support**: Supports Millimeters, Centimeters, Inches, Points, and Pixels.
- **Adjustable Spacing**: Set the gap between nested objects.
- **90° Rotation**: Optional rotation to optimize space usage.
- **Weeding Frames**: Optional boundary frames for easier cutting/weeding.
- **Shelf-Packing Algorithm**: Simple but effective packing for rectangular bounds.

## Installation
1. Download `IllustratorNesting.jsx`.
2. Move it to your Illustrator scripts folder:
   - **Windows**: `C:\Program Files\Adobe\Adobe Illustrator [Version]\Presets\[Language]\Scripts`
   - **macOS**: `/Applications/Adobe Illustrator [Version]/Presets/[Language]/Scripts`
3. Restart Illustrator.

## Usage
1. Open an Illustrator document.
2. Select the objects you want to nest.
3. Go to `File > Scripts > IllustratorNesting`.
4. Configure your settings and click **Starta Nesting**.

## License
This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. This means:
- You are free to use, modify, and distribute the code.
- If you distribute a modified version, it **must** also be open-source under the same license.
- It prevents the code from being used in closed-source proprietary software.
- See the [LICENSE](LICENSE) file for more details.
