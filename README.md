# Software Rasterizer Canvas

A real-time software-based 3D rasterizer that transforms geometric meshes into fully rendered, illuminated 2D scenes using raw pixel manipulation on an HTML5 Canvas.

## Overview

Most web-based 3D applications hand off hardware execution to WebGL or WebGPU. This project skips GPU abstractions entirely to build the core mathematical and algorithmic pipeline of 3D graphics inside vanilla JavaScript.

By writing directly to a 2D Canvas ImageData pixel buffer, it implements every stage of the classical rendering pipeline manually: linear transformations, vertex projection, back-face culling, depth sorting via a floating-point z-buffer, and barycentric-style triangle rasterization with directional diffuse lighting.

## How It Works

The engine receives 3D vertex and face data, pushes each frame through mathematical transformations, and updates an in-memory pixel array before displaying it.

```text
+------------------+     +-----------------------+     +---------------------+
|  3D Mesh Data    | --> | Model-View Matrix     | --> | Perspective         |
|  (Vertices/Faces)|     | Transformation        |     | Projection          |
+------------------+     +-----------------------+     +---------------------+
|
+------------------+     +-----------------------+                v
| Output Frame     | <-- | Z-Buffered Pixel      | <-- +---------------------+
| (Canvas Display) |     | Rasterization & Light |     | Back-face Culling   |
+------------------+     +-----------------------+     +---------------------+
```

1. **Winding Normalization**: During mesh instantiation, `fixWinding()` checks face normal directions against object centroids to ensure uniform counter-clockwise triangle winding across all primitives.
2. **Matrix Transformations**: Vertices undergo row-major 4x4 matrix multiplications to apply X/Y rotation and world-space translation.
3. **Camera Projection**: Coordinates convert to Normalized Device Coordinates (NDC) based on field-of-view, perspective division, and aspect ratio adjustments before mapping to screen coordinates.
4. **Culling & Lighting**: Triangles facing away from the camera point-of-view drop out based on the dot product of their face normal and camera vector. Active faces evaluate diffuse lighting against a fixed light vector.
5. **Rasterization & Z-Buffering**: Bounding boxes determine candidate screen pixels. An edge function evaluates barycentric coverage, interpolates inverse depth values (`1/z`), checks the depth array, and updates the canvas pixel buffer directly when a pixel passes the depth test.

## Key Features

* **Manual Matrix Mathematics**: Built-in 4x4 matrix operations for rotation, translation, and point transformations.
* **Custom Software Z-Buffer**: Float32Array-backed depth buffer prevents visual artifacts on overlapping geometric primitives.
* **Barycentric Edge-Function Rasterizer**: Accurate sub-pixel triangle filling using direct array buffer pixel writes (`ctx.createImageData`).
* **Automated Face Winding Correction**: Runtime face sorting eliminates manual winding orientation mistakes across complex geometries.
* **Dynamic Canvas Controls**: Configurable rotation speed, zoom levels, toggleable wireframe overlays, auto-rotation, and interactive orbit dragging.

## Tech Stack Breakdown

* **Language**: Vanilla JavaScript (ES6+)
* **Rendering Surface**: HTML5 Canvas 2D Context (`ImageData` pixel buffers)
* **Styling**: CSS3 (Flexbox layout, clean control panel overlays)

## Prerequisites & Web-Based Quick Start

You don't need local build tools, compilers, or Node packages to run or edit this project.

### Running with GitHub Codespaces
1. Click the **Code** button at the top of this repository.
2. Select the **Codespaces** tab and click **Create codespace on main**.
3. Install the **Live Server** extension inside the browser-based VS Code environment.
4. Right-click `index.html` and click **Open with Live Server**.

### Running Locally
1. Download or clone this repository.
2. Open `index.html` directly in any modern web browser.

## Project Structure

```text
software-rasterizer-canvas/
├── .github/
│   └── workflows/
│       └── code-health.yml   # Lints JS files and validates document structure
├── index.html                 # Main interface layout and viewport element
├── style.css                  # UI layout and interactive panel styles
├── script.js                 # Complete 3D pipeline logic and rendering engine
├── .gitignore                 # Tracked file exclusions
└── LICENSE                    # MIT License file
```

## Roadmap

* [ ] Add directional light direction sliders to the control UI.
* [ ] Implement OBJ file parser to load custom 3D geometries from external assets.
* [ ] Integrate simple texture mapping using barycentric coordinate interpolation.
* [ ] Add dynamic perspective/orthographic toggle support.
