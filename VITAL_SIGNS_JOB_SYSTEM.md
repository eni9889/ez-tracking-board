# 🩺 Vital Signs Carryforward Job System

The vital signs carryforward functionality has been moved from frontend to a **server-side job system** using BullMQ and Redis.

## ✅ **What's New**

### **Server-Side Processing**
- **🔄 Automatic job** runs every 10 seconds
- **📊 Processes READY_FOR_STAFF and WITH_STAFF patients**
- **🛡️ Single job instance** - no duplicates
- **💾 Stored credentials** - no frontend dependencies
- **📈 Better reliability** and error handling

### **Database-Stored Authentication**
- User credentials stored securely in SQLite
- Automatic token management and refresh
- No need for frontend to handle authentication

## 🚀 **How It Works**

1. **User logs in** through frontend (first time only)
2. **Credentials stored** in database automatically
3. **Job system** authenticates independently using stored credentials
4. **Every 10 seconds**, job:
   - Fetches today's encounters
   - Filters READY_FOR_STAFF and WITH_STAFF patients
   - Processes vital signs carryforward for eligible patients
   - Tracks processed encounters to prevent duplicates

## 📋 **Prerequisites**

### **Redis Server**
You need Redis running for the job queue:

```bash
# Install Redis (macOS with Homebrew)
brew install redis

# Start Redis
brew services start redis

# Or run temporarily
redis-server
```

### **Environment Variables** (Optional)
```bash
# server/.env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 🔧 **Setup Instructions**

1. **Install dependencies** (already done):
   ```bash
   cd server && npm install
   ```

2. **Start Redis**:
   ```bash
   brew services start redis
   ```

3. **Start the server**:
   ```bash
   cd server && npm run dev
   ```

4. **Login through frontend** (one time):
   - Your credentials will be stored for job system use

5. **Monitor job logs**:
   - Check server console for job execution logs
   - Jobs run every 10 seconds automatically

## 📊 **Monitoring**

### **Server Logs**
```bash
🔄 Starting vital signs carryforward job...
📋 Found 2 patients to process for vital signs carryforward
🩺 Processing vital signs for John Smith (READY_FOR_STAFF)
✅ Successfully processed vital signs for John Smith
⏭️ Skipping Jane Doe - already processed
🏁 Vital signs job completed: {"processed":1,"successful":1,"failed":0}
```

### **Job Statistics API**
```bash
GET /api/vital-signs/stats
```

## 🛑 **Manual Control**

### **Individual Patient Processing** (Still Available)
```bash
POST /api/vital-signs/process/:encounterId
```

### **Batch Processing** (Still Available)
```bash
POST /api/vital-signs/process-all
```

## 🔍 **Troubleshooting**

### **No Job Activity**
1. Check Redis is running: `redis-cli ping`
2. Verify credentials stored: Check server logs for "Stored credentials for user"
3. Check for authentication errors in job logs

### **Jobs Failing**
1. Check EZDerm API connectivity
2. Verify stored credentials are valid
3. Check database permissions

### **Multiple Job Instances**
- Job system ensures only one instance with `jobId: 'vital-signs-carryforward'`
- If concerned, restart server to reset job queue

## 🎯 **Benefits**

✅ **More Reliable** - No dependency on frontend being open  
✅ **Automatic** - Runs continuously without user interaction  
✅ **Efficient** - Server-side processing with proper error handling  
✅ **Scalable** - Redis-based job queue can handle high loads  
✅ **Monitoring** - Better visibility into processing status  
✅ **Centralized** - All logic in one place

## 🚫 **What Was Removed**

- ❌ Frontend vital signs processing logic
- ❌ Manual trigger buttons from UI  
- ❌ Frontend visual indicators (spinners/checkmarks)
- ❌ Client-side status tracking

The system now works **completely automatically** in the background! 🎉 