# 🔐 SQLite Session Persistence System

The app now uses **server-side SQLite session management** instead of localStorage for secure, persistent authentication.

## ✅ **What's New**

### **🛡️ Server-Side Sessions**
- **Sessions stored in SQLite database** on the server
- **Secure session tokens** generated with crypto
- **8-hour session duration** with automatic expiration
- **Session validation middleware** for all protected endpoints

### **🔄 Automatic Session Management**
- **Persistent sessions** survive browser refresh/restart
- **Automatic cleanup** of expired sessions
- **Session restoration** on app startup
- **Secure logout** with proper session deletion

## 🚀 **How It Works**

### **Login Process**
1. ✅ User enters credentials
2. ✅ Server validates with EZDerm API
3. ✅ Server creates session record in SQLite
4. ✅ Returns `sessionToken` and `expiresAt` to frontend
5. ✅ Frontend stores session data in localStorage
6. ✅ All subsequent API calls use session token

### **API Request Authentication**
```typescript
// Frontend automatically includes session token
headers: {
  'Authorization': `Bearer ${sessionToken}`
}
```

### **Session Validation**
- **Middleware checks** session token on every protected endpoint
- **Validates** token exists and hasn't expired
- **Updates** last accessed timestamp
- **Extracts username** for request processing

## 📊 **Database Schema**

### **user_sessions Table**
```sql
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN DEFAULT 1
);
```

## 🔧 **Session Management**

### **Session Creation**
```typescript
// Server creates secure session
const sessionToken = crypto.randomBytes(32).toString('hex');
const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

await vitalSignsDb.createSession(
  sessionToken, 
  username, 
  expiresAt, 
  userAgent, 
  ipAddress
);
```

### **Session Validation**
```typescript
// Middleware validates every request
const session = await vitalSignsDb.validateSession(sessionToken);
if (!session) {
  return res.status(401).json({ error: 'Invalid or expired session' });
}
```

### **Automatic Cleanup**
- **Hourly cleanup** removes expired sessions
- **Startup cleanup** on server restart
- **Logout cleanup** when user logs out

## 🎯 **Benefits Over localStorage**

| Feature | localStorage | SQLite Sessions |
|---------|-------------|-----------------|
| **Security** | Client-side, easy to tamper | Server-side, secure |
| **Control** | No server oversight | Full server control |
| **Tracking** | No usage tracking | User agent, IP, timestamps |
| **Expiration** | Client-side only | Server-enforced |
| **Multi-device** | Per-browser only | Centrally managed |
| **Audit Trail** | None | Full session history |

## 📱 **Frontend Session Storage**

### **Stored in localStorage** (for convenience only)
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "username": "your-username",
  "expiresAt": "2025-08-04T07:30:00.000Z",
  "serverUrl": "https://srvprod.ezinfra.net/"
}
```

### **Automatic Restoration**
- **On app load**: Checks localStorage for session
- **Validates expiration**: Client-side pre-check
- **Server validation**: All requests still validated server-side

## 🔒 **Security Features**

### **Token Security**
- **32-byte random tokens** using Node.js crypto
- **Unpredictable** and **non-sequential**
- **Unique per session**

### **Expiration Management**
- **8-hour server-enforced expiration**
- **Automatic cleanup** of expired sessions
- **Last accessed tracking** for usage monitoring

### **Request Protection**
- **All protected endpoints** require valid session
- **Middleware validation** before processing
- **Graceful error handling** for invalid tokens

## 🛠️ **API Changes**

### **Login Response** (Updated)
```typescript
{
  "success": true,
  "username": "your-username",
  "serverUrl": "https://srvprod.ezinfra.net/",
  "sessionToken": "a1b2c3d4e5f6...",      // NEW
  "expiresAt": "2025-08-04T07:30:00.000Z"  // NEW
}
```

### **Protected Endpoints** (Updated)
- `/api/encounters` - Requires session token
- `/api/vital-signs/process/:id` - Requires session token  
- `/api/vital-signs/process-all` - Requires session token

### **Session Management**
- `POST /api/logout` - Deletes session from database
- Session cleanup runs automatically every hour

## 🐛 **Development Mode**

### **Mock Sessions**
```typescript
// Development mode creates mock sessions
const mockSessionToken = 'mock_session_' + Date.now();
const mockExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
```

### **No Server Required**
- Mock sessions work without backend database
- Full session functionality in development

## 🚫 **What Was Removed**

- ❌ Client-side session management
- ❌ localStorage-only authentication  
- ❌ Username-based endpoint authentication
- ❌ In-memory session storage

## 🎉 **Result**

✅ **Secure server-side sessions**  
✅ **8-hour persistent authentication**  
✅ **Automatic session cleanup**  
✅ **Better security and control**  
✅ **Survives browser refresh/restart**  
✅ **Production-ready session management**

No more repeated logins and much better security! 🔐 