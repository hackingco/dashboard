# Admin Dashboard - admin.hacking.co

A modern, responsive React TypeScript dashboard for managing swarm infrastructure.

## Features

- **Dashboard Overview**: Real-time swarm status and metrics
- **Swarm Management**: Create, scale, start/stop, and destroy swarms
- **Worker Monitoring**: Monitor individual worker nodes with CPU, memory, and network metrics
- **Log Viewer**: Centralized log aggregation with filtering and search
- **Metrics Dashboard**: Performance analytics with visual charts
- **Settings**: Configure API endpoints, notifications, and system parameters

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons
- **Radix UI** for accessible UI components

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

The development server runs on `http://localhost:5173` by default.

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── Layout.tsx   # Main layout with sidebar
│   └── ui/          # UI components (buttons, cards, etc.)
├── pages/           # Page components
│   ├── Dashboard.tsx
│   ├── Swarms.tsx
│   ├── Workers.tsx
│   ├── Logs.tsx
│   ├── Metrics.tsx
│   └── Settings.tsx
├── lib/             # Utilities
│   └── utils.ts     # Helper functions
├── App.tsx          # Main app component with routing
├── main.tsx         # Entry point
└── index.css        # Global styles with Tailwind
```

## Design System

### Colors

- **Background**: Dark theme with `dark-950` base
- **Primary**: Blue accent colors (`accent-500`, `accent-600`)
- **Surface**: `dark-900` for cards and panels
- **Borders**: `dark-800` for subtle borders

### Components

- **Glass Effect**: Semi-transparent backgrounds with backdrop blur
- **Glow Effect**: Subtle shadow for highlighted elements
- **Custom Scrollbar**: Styled scrollbars matching the dark theme

### Responsive Design

- Mobile-first approach
- Collapsible sidebar for mobile/tablet
- Responsive grid layouts
- Touch-friendly interface

## API Integration

The dashboard is designed to work with the Swarm Manager API. Configure the API endpoint in the Settings page.

## Environment Variables

Create a `.env` file for environment-specific configuration:

```env
VITE_API_URL=https://api.hacking.co
VITE_API_KEY=your-api-key
```

## Building for Production

```bash
# Build the project
npm run build

# The output will be in the dist/ directory
# Serve with any static file server
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT