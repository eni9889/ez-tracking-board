# EZ Patient Tracking Dashboard

A real-time patient tracking dashboard for dermatology clinics using the EZDerm API.

## Features

- **Real-time Patient Tracking**: Monitor patient status throughout their visit
- **Status Management**: Track patients from scheduled through check-out
- **Room Assignment**: See which room each patient is in
- **Provider Information**: View which provider is assigned to each patient
- **Wait Time Tracking**: Monitor how long patients have been waiting
- **Auto-refresh**: Dashboard updates every 30 seconds
- **Filtering**: Filter patients by status
- **Multi-clinic Support**: Switch between different clinic locations

## Patient Status Flow

1. **SCHEDULED** - Patient has an appointment
2. **CHECKED_IN** - Patient has arrived and checked in
3. **IN_ROOM** - Patient has been placed in an exam room
4. **WITH_PROVIDER** - Provider is with the patient
5. **CHECKED_OUT** - Visit complete, patient has left

## Getting Started

### Prerequisites

- Node.js 18+ and npm (for local development)
- Docker Desktop (for containerized development)
- Valid EZDerm API credentials
- PostgreSQL 14+ (for local development without Docker)
- Redis 7+ (for local development without Docker)

### Installation

#### Option 1: Docker Development (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd ez-tracking-board
```

2. Start all services with Docker Compose:
```bash
# Quick setup
make setup

# Or manually
docker-compose up
```

3. Access the application:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:5001](http://localhost:5001)
- pgAdmin: [http://localhost:5050](http://localhost:5050) (optional)

For detailed Docker instructions, see [DOCKER_DEVELOPMENT.md](./DOCKER_DEVELOPMENT.md).

#### Option 2: Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd ez-tracking-board
```

2. Install dependencies:
```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server && npm install
cd ..
```

3. Set up PostgreSQL and Redis:
```bash
# macOS
brew install postgresql redis
brew services start postgresql
brew services start redis

# Create database
createdb vital_signs_tracking
```

4. Start the services:
```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Login**: Use your EZDerm credentials to log in
2. **Select Clinic**: Choose the clinic location from the dropdown
3. **View Patients**: See all patients scheduled for today
4. **Filter by Status**: Click on status chips to filter patients
5. **Refresh**: Click the refresh button or wait for auto-refresh

## Development

### Project Structure

```
src/
├── components/      # Reusable UI components
├── contexts/        # React contexts (Auth)
├── pages/          # Page components (Login, Dashboard)
├── services/       # API services
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

### Key Technologies

- **React** with TypeScript
- **Material-UI** for UI components
- **React Router** for navigation
- **Axios** for API calls
- **date-fns** for date formatting

### Mock Data

In development mode, you can toggle between live API data and mock data using the "Using Live/Mock Data" button.

## API Integration

The dashboard integrates with the EZDerm API endpoints:

- `https://login.ezinfra.net/api/login` - Authentication with proper EZDerm format
- `/api/practice/info` - Practice and clinic information
- `/api/event/multipleUserSchedulerData` - Patient appointment data
- `/api/encounter/getByFilter` - Enhanced encounter details with arrival times and status updates

### Enhanced Patient Tracking

The dashboard combines scheduler data with encounter information to provide:
- **Accurate Check-in Times**: Uses `dateOfArrival` from encounters
- **Detailed Status Tracking**: Maps encounter statuses to appointment workflow
- **Chief Complaint Information**: Enhanced from encounter data
- **Timeline Tracking**: Shows progression through appointment stages
- **Room Management**: Displays room assignments from encounter data
- **Provider Teams**: Shows primary and secondary providers for each encounter

### Encounter API Format

The encounter request uses the exact EZDerm API format:
```json
{
  "dateSelection": "SPECIFY_RANGE",
  "lightBean": true,
  "dateOfServiceRangeHigh": "2025-07-25T00:00:00-0400",
  "dateOfServiceRangeLow": "2025-07-24T00:00:00-0400",
  "clinicId": "44b62760-50a1-488c-92ed-e0c7aa3cde92",
  "providerIds": ["293a1b60-5ac0-11f0-9955-6fb3fb81def7"],
  "practiceId": "4cc96922-4d83-4183-863b-748d69de621f"
}
```

## Security

- Tokens are stored in localStorage
- Automatic token refresh before expiration
- Secure API communication over HTTPS

## Development Mode

In development, the app includes several features to help with testing and development:

- **Automatic Fallback**: If real API calls fail (due to CORS or network issues), the app automatically falls back to mock authentication and data
- **Mock Data Toggle**: Use the "Using Live/Mock Data" button to switch between real API calls and mock data
- **Development Indicators**: Clear labels show when you're in development mode and using mock data

## Troubleshooting

### CORS Issues in Development
**Problem**: Browser blocks API calls due to CORS policy
**Solution**: 
- The app automatically falls back to mock data in development mode
- For production deployment, ensure proper CORS headers are configured on the API server
- Consider using a proxy server or deploying the app to the same domain as the API

### Can't Login
- In development: The app will automatically use mock authentication if real login fails
- Verify your credentials are correct
- Check your network connection
- Ensure the API server is accessible

### No Patients Showing
- Toggle to mock data mode using the button in the header to test the UI
- Verify you have selected the correct clinic
- Check that there are appointments scheduled for today
- Check browser console for API errors

### Dashboard Not Updating
- Try toggling between live and mock data modes
- Check your internet connection
- Refresh the page manually
- Check browser console for errors

## Future Enhancements

- [ ] Edit appointment status directly from dashboard
- [ ] Add patient search functionality
- [ ] Export daily reports
- [ ] Push notifications for status changes
- [ ] Mobile responsive improvements
- [ ] Dark mode support
