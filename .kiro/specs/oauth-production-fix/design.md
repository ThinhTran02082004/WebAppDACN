# Design Document

## Overview

Giải pháp cho vấn đề OAuth callback 404 trên production bao gồm việc cấu hình Vercel rewrites để xử lý client-side routing cho React SPA. Vấn đề xảy ra vì Vercel cố gắng tìm file `/auth/social-callback` trên server thay vì để React Router xử lý route này.

## Architecture

### Current Flow (Broken on Production)

```
User clicks OAuth login
  ↓
Redirect to Google/Facebook
  ↓
OAuth provider redirects to Railway backend
  ↓
Railway backend processes OAuth & redirects to:
  https://dacs-hospitalweb.vercel.app/auth/social-callback?data={...}
  ↓
Vercel tries to find /auth/social-callback file
  ↓
❌ 404 NOT_FOUND (file doesn't exist)
```

### Fixed Flow (With Vercel Rewrites)

```
User clicks OAuth login
  ↓
Redirect to Google/Facebook
  ↓
OAuth provider redirects to Railway backend
  ↓
Railway backend processes OAuth & redirects to:
  https://dacs-hospitalweb.vercel.app/auth/social-callback?data={...}
  ↓
Vercel rewrites /auth/social-callback → /index.html
  ↓
React app loads & React Router handles /auth/social-callback
  ↓
✅ SocialCallback component processes authentication
```

## Components and Interfaces

### 1. Vercel Configuration File

**File:** `client/vercel.json`

**Purpose:** Cấu hình Vercel để rewrite tất cả routes về index.html cho React Router

**Structure:**
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Explanation:**
- `source: "/(.*)"` - Match tất cả routes
- `destination: "/index.html"` - Serve index.html cho tất cả routes
- React Router sẽ xử lý routing phía client

### 2. Environment Variables Verification

**Backend (.env):**
```
FRONTEND_URL=https://dacs-hospitalweb.vercel.app
```

**Purpose:** Đảm bảo server redirect về đúng frontend URL

### 3. OAuth Callback Flow

**Component:** `client/src/pages/user/SocialCallback.jsx`

**Current Implementation:** ✅ Đã đúng
- Parse `data` parameter từ URL
- Decode và parse JSON user data
- Call `login()` từ AuthContext
- Redirect theo role hoặc saved redirect path

**No changes needed** - Component đã xử lý đúng, chỉ cần Vercel serve được route này

## Data Models

### OAuth Callback URL Structure

```
https://dacs-hospitalweb.vercel.app/auth/social-callback?data={encoded_json}
```

**Encoded JSON Structure:**
```json
{
  "_id": "user_id",
  "fullName": "User Name",
  "email": "user@email.com",
  "phoneNumber": "0123456789",
  "roleType": "user",
  "avatarUrl": "https://...",
  "googleId": "google_id",
  "isNewUser": false,
  "needPassword": false,
  "token": "jwt_token"
}
```

## Error Handling

### Current Error (404)

**Cause:** Vercel không tìm thấy file `/auth/social-callback`

**Solution:** Vercel rewrites sẽ serve `index.html` thay vì tìm file

### Potential Errors After Fix

1. **CORS Issues**
   - Ensure Railway backend has correct CORS configuration
   - Frontend URL must be in allowed origins

2. **Token Validation Errors**
   - Backend logs show token generation successful
   - Frontend should validate token before storing

3. **Redirect Loop**
   - Ensure `processedRef` in SocialCallback prevents multiple processing
   - Current implementation: ✅ Already handled

## Testing Strategy

### 1. Local Testing

**Test OAuth flow on localhost:**
```bash
# Start backend
cd server
npm start

# Start frontend
cd client
npm run dev
```

**Expected:** OAuth works normally (already confirmed working)

### 2. Production Testing

**After deploying vercel.json:**

1. **Test Google Login:**
   - Click "Đăng nhập với Google"
   - Complete Google OAuth
   - Should redirect to `/auth/social-callback`
   - Should process authentication
   - Should redirect to dashboard/home

2. **Test Facebook Login:**
   - Click "Đăng nhập với Facebook"
   - Complete Facebook OAuth
   - Should redirect to `/auth/social-callback`
   - Should process authentication
   - Should redirect to dashboard/home

3. **Test Direct URL Access:**
   - Navigate directly to `https://dacs-hospitalweb.vercel.app/auth/social-callback`
   - Should load React app (not 404)
   - Should show error message (no data parameter)

### 3. Verification Steps

**Check Vercel Deployment:**
```bash
# Deploy to Vercel
cd client
vercel --prod
```

**Verify rewrites are applied:**
- Check Vercel dashboard → Project → Settings → Rewrites
- Should show: `/*` → `/index.html`

**Check Railway logs:**
```
Social login successful for user: [email] with provider: [google/facebook]
```

**Check browser console:**
```
Đăng nhập thành công với dữ liệu: {...}
```

## Implementation Notes

### Why This Solution Works

1. **SPA Routing:** React apps use client-side routing, all routes should serve index.html
2. **Vercel Default:** Vercel doesn't automatically rewrite routes for SPAs without configuration
3. **No Backend Changes:** Backend is working correctly, only frontend deployment needs fixing

### Alternative Solutions (Not Recommended)

1. ❌ **Change callback URL to root:** Would require parsing params on home page
2. ❌ **Use hash routing:** Would break existing routes and SEO
3. ❌ **Server-side rendering:** Overkill for this issue

### Best Practices

1. ✅ Use `vercel.json` for SPA configuration
2. ✅ Keep OAuth callback route in React Router
3. ✅ Maintain environment-specific URLs
4. ✅ Log OAuth flow for debugging
