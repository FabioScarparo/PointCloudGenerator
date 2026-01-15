# Point Cloud Generator

An interactive 3D point cloud generator with advanced controls for creating complex geometric shapes.

![Point Cloud Generator](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Interactive Curve Editors**: Two separate editors for controlling vertical profile and horizontal shape
- **Multiple Geometry Modes**:
  - Sweep Shape: Extrude a shape along a path
  - Revolution: Create solids of revolution
  - Sheet (Depth Map Like): Generate surfaces
- **Advanced Color Modes**:
  - Solid color
  - Height-based gradient
  - Depth-based gradient
- **Comprehensive Controls**:
  - Adjustable point density
  - Height scaling
  - Point radius
  - Noise intensity
  - Viewport zoom
  - Auto-rotation
  - Customizable background (color and transparency)
- **Multiple Export Formats**:
  - PNG (raster image)
  - SVG (vector graphics)
  - OBJ (3D model)
- **Themes**: Light and dark mode support
- **Modern Design**: Clean interface with Apple Blue aesthetic

## Live Demo

Visit the live demo: [https://fabioscarparo.github.io/PointCloudGenerator](https://fabioscarparo.github.io/PointCloudGenerator)

## Local Development

### Prerequisites

- Node.js (version 18 or higher)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/fabioscarparo/PointCloudGenerator.git

# Navigate to the directory
cd PointCloudGenerator

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

```bash
# Create production build
npm run build

# Preview the build
npm run preview
```

## Project Structure

PointCloudGenerator/
├── src/
│   ├── main.js              # Application entry point
│   ├── Renderer.js          # 3D rendering with canvas
│   ├── CurveEditor.js       # Interactive curve editor
│   ├── SurfaceGenerator.js  # 3D surface generation
│   ├── Exporter.js          # PNG, SVG, OBJ export
│   ├── math.js              # Mathematical utilities
│   └── style.css            # Global styles
├── index.html               # Main HTML file
├── vite.config.js           # Vite configuration
└── package.json             # Project dependencies

## Usage

1. **Edit Vertical Profile**: Use the top editor to control height and scale along the Y-axis
2. **Edit Horizontal Shape**: Use the middle editor to define the shape on the X-Z plane
3. **Adjust Parameters**: Use the sidebar controls to modify density, colors, zoom, etc.
4. **Export**: Save your work as PNG, SVG, or OBJ

## Contributing

Contributions are welcome! Feel free to open issues or pull requests.

## License

This project is licensed under the MIT License.

## Author

Created by Fabio Scarparo
