# 3D Maps Explorer

An interactive 3D map experience built with Next.js and Google Maps JavaScript API 3D Maps feature.

## Features

- Full-screen 3D photorealistic map view
- Pre-configured locations (San Francisco, New York, Tokyo, London, Grand Canyon)
- Toggle between Hybrid and Satellite modes
- Mobile-optimized PWA experience
- Smooth camera controls (rotate, zoom, pan)

## Getting Started

### Prerequisites

1. A Google Cloud Platform account
2. A Google Maps API key with **Maps JavaScript API** enabled

### Setup

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

3. Add your Google Maps API key to `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Getting a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **API Key**
5. Enable the **Maps JavaScript API** in **APIs & Services** > **Library**
6. (Recommended) Restrict your API key to your domain for security

### Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the 3D map.

## Controls

- **Click + Drag**: Rotate the view
- **Scroll / Pinch**: Zoom in/out
- **Shift + Drag**: Pan the map

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [Google Maps JavaScript API (3D Maps)](https://developers.google.com/maps/documentation/javascript/reference/3d-map) - 3D mapping
- [Tailwind CSS 4](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Project Structure

```
src/
├── app/
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout with PWA meta
│   └── page.tsx        # Main page with location controls
└── components/
    └── Map3D.tsx       # 3D Map component
```

## License

MIT
