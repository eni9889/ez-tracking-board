# Tailscale VPN-Only Access Setup

This guide shows how to configure your DigitalOcean App Platform deployment to only allow access from users connected to your Tailscale VPN.

## 🔒 How It Works

The authentication layer approach adds Tailscale verification as middleware to your existing app:

1. **Keep Current Infrastructure**: Your DigitalOcean App Platform setup stays unchanged
2. **Add Auth Middleware**: Every request is checked against your Tailscale network
3. **IP Verification**: Only requests from authorized Tailscale IPs are allowed through
4. **Graceful Denial**: Non-VPN users get a clear access denied message

## 🛠️ Setup Steps

### 1. Create Tailscale API Key

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/)
2. Navigate to **Settings** → **Keys**
3. Click **Generate auth key** or **API key**
4. Select these scopes:
   - `devices:read` - to list devices in your tailnet
   - `users:read` - to get user information
5. Copy the generated API key

### 2. Get Your Tailnet Name

Your tailnet name is one of:
- **Personal account**: `tail12345.ts.net` (found in admin console)
- **Custom domain**: `yourcompany.com` (if you've set up a custom domain)

### 3. Configure Environment Variables

In your DigitalOcean App Platform console:

1. Go to your app → **Settings** → **Environment Variables**
2. Add these secrets:

```bash
TAILSCALE_ENABLED=true
TAILSCALE_TAILNET=your-tailnet-name.ts.net
TAILSCALE_API_KEY=tskey-api-xxxxxxxxxxxxx
```

### 4. Update Your App Configuration

The `.do/app.yaml` file already includes the environment variables. You just need to update the placeholder values.

### 5. Deploy

Push your changes and deploy:

```bash
git add .
git commit -m "Add Tailscale VPN-only access"
git push
```

## 🧪 Testing

### Test VPN Access
1. Connect to your Tailscale VPN
2. Visit your app: `https://app.dccderm.com`
3. Should work normally ✅

### Test Non-VPN Access
1. Disconnect from Tailscale VPN (or use incognito/different browser)
2. Visit your app: `https://app.dccderm.com`
3. Should see access denied message ❌

```json
{
  "error": "Access Denied",
  "message": "This application is only accessible through our company VPN. Please connect to the VPN and try again.",
  "code": "TAILSCALE_AUTH_REQUIRED"
}
```

## 📊 Monitoring

### Health Check
Your health check endpoint now includes Tailscale status:

```bash
curl https://app.dccderm.com/api/health
```

Response includes:
```json
{
  "status": "healthy",
  "tailscale": {
    "status": "healthy",
    "tailnet": "your-tailnet.ts.net",
    "deviceCount": 15,
    "userCount": 8
  }
}
```

### Logs
Watch the logs for Tailscale authentication events:

```
🔒 Tailscale authentication enabled for tailnet: yourcompany.ts.net
🔍 Checking Tailscale auth for IP: 100.64.0.5
✅ Tailscale auth successful for IP: 100.64.0.5
❌ Tailscale auth failed for IP: 203.0.113.1
```

## 🔧 Configuration Options

### Development Mode
Set `TAILSCALE_BYPASS_DEV=true` to bypass Tailscale auth in development:

```bash
# .env.local for local development
TAILSCALE_ENABLED=true
TAILSCALE_BYPASS_DEV=true  # Bypasses auth when NODE_ENV=development
```

### Disable Tailscale Auth
To temporarily disable:

```bash
TAILSCALE_ENABLED=false
```

## 🚨 Troubleshooting

### "Access Denied" for VPN Users

**Check:**
1. ✅ User device is authorized in Tailscale admin
2. ✅ Device is not blocked
3. ✅ API key has correct permissions
4. ✅ Tailnet name is correct

### API Key Issues

**Error: 401 Unauthorized**
- API key is invalid or expired
- Generate a new key with proper scopes

**Error: 403 Forbidden**
- API key doesn't have required permissions
- Add `devices:read` and `users:read` scopes

### High Latency

The middleware caches device information for 5 minutes to reduce API calls. If you need faster updates, modify the `CACHE_TTL` in `tailscaleAuth.ts`.

## 🔐 Security Benefits

✅ **Network-level Security**: Only VPN users can access your app
✅ **No Public Exposure**: App is invisible to internet scanners
✅ **Audit Trail**: All access attempts are logged
✅ **Centralized Control**: Manage access through Tailscale admin
✅ **Zero Trust**: Each request is verified individually

## 📝 Notes

- **Caching**: Device information is cached for 5 minutes for performance
- **Failsafe**: If Tailscale API is unreachable, access is denied (fail-secure)
- **IP Detection**: Handles proxy headers (`X-Forwarded-For`, `X-Real-IP`)
- **Development**: Automatically bypasses auth in development mode
