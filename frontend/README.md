# EZ Tracking Board - Frontend

React frontend application for the EZ Patient Tracking Dashboard.

## Development

### Prerequisites
- Node.js 18+
- npm

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

### Environment Variables

Create a `.env` file in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:5001
REACT_APP_USE_MOCK_DATA=false
```

### Project Structure

```
src/
├── components/         # Reusable UI components
│   └── PrivateRoute.tsx
├── contexts/          # React contexts
│   ├── AuthContext.tsx
│   └── EncountersContext.tsx
├── pages/            # Page components
│   ├── AINoteChecker.tsx
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   └── NoteDetail.tsx
├── services/         # API services
│   ├── aiNoteChecker.service.ts
│   ├── auth.service.ts
│   ├── mockData.ts
│   └── patientTracking.service.ts
└── types/           # TypeScript definitions
    └── api.types.ts
```

### Key Technologies

- **React 19** with TypeScript
- **Material-UI** for UI components
- **React Router** for navigation
- **Axios** for API calls
- **date-fns** for date formatting

### Building for Production

```bash
npm run build
```

Creates optimized production build in the `build` folder.

### Docker Development

Build and run with Docker:

```bash
docker build -f Dockerfile.dev -t ez-tracking-frontend .
docker run -p 3000:3000 ez-tracking-frontend
```

### Mock Data

Toggle between live API and mock data using the "Using Live/Mock Data" button in the header during development.
