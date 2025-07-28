# EZ Tracking Board Server

TypeScript backend server for the EZ Patient Tracking Board application.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
server/
├── src/
│   ├── tracking-server.ts    # Main server file
│   └── types.ts             # TypeScript type definitions
├── dist/                    # Compiled JavaScript output
├── tsconfig.json           # TypeScript configuration
├── nodemon.json            # Development server configuration
└── package.json            # Dependencies and scripts
```

## 🔧 TypeScript Configuration

- **Target**: ES2020
- **Module**: CommonJS
- **Strict mode**: Enabled with comprehensive type checking
- **Source maps**: Generated for debugging
- **Output directory**: `./dist`

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:watch` | Watch mode compilation |
| `npm start` | Start production server from compiled JS |

## 📦 Dependencies

### Runtime
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `axios` - HTTP client for API requests
- `dotenv` - Environment variable management
- `express-rate-limit` - Rate limiting middleware

### Development
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution for development
- `nodemon` - File watcher for development
- `@types/*` - Type definitions for JavaScript libraries

## 🔒 Environment Variables

Create a `.env` file in the server directory:

```env
PORT=5001
NODE_ENV=development
```

## 🏥 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/login` | POST | User authentication |
| `/api/encounters` | POST | Fetch patient encounters |
| `/api/logout` | POST | User logout |

## 🔍 Type Safety

The server is fully typed with TypeScript, including:

- **Request/Response types** for all endpoints
- **EZDerm API types** for external service integration
- **Patient and encounter models** with strict typing
- **Error handling** with typed error responses

## 🚧 Development Features

- **Hot reload** with nodemon and ts-node
- **Strict type checking** prevents runtime errors
- **Comprehensive error handling** with typed responses
- **Rate limiting** to prevent API abuse
- **CORS** configured for frontend integration 