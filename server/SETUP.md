# Server Setup Guide

## Environment Variables Setup

**IMPORTANT:** Never commit your `.env` file to version control!

### Step 1: Create your .env file

Copy the template from `env-setup.txt` to create your own `.env` file:

```bash
# In the server directory
cp env-setup.txt .env
```

### Step 2: Fill in your credentials

Edit `.env` and replace the placeholder values with your actual credentials:

#### Database
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: A strong random secret for JWT tokens (use a password generator)

#### Email
- `EMAIL_USER`: Your Gmail address
- `EMAIL_PASS`: Gmail App Password (not your regular password)
  - Get it from: https://myaccount.google.com/apppasswords

#### Google OAuth
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  - Get from: https://console.cloud.google.com/
  - Create OAuth 2.0 credentials
  - Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`

#### Facebook OAuth
- `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`
  - Get from: https://developers.facebook.com/
  - Create a new app
  - Add Facebook Login product

#### Cloudinary (for image uploads)
- Get credentials from: https://cloudinary.com/

#### Payment Providers
- PayPal: https://developer.paypal.com/
- MoMo: Contact MoMo for developer credentials

### Step 3: Install dependencies

```bash
npm install
```

### Step 4: Run the server

```bash
npm start
# or for development with auto-reload
npm run dev
```

## Security Notes

- ✅ The `.env` file is now in `.gitignore` and won't be committed
- ✅ Never share your `.env` file or credentials in public repositories
- ✅ Use different credentials for development and production
- ✅ Rotate your secrets regularly
- ✅ Use strong, randomly generated values for `JWT_SECRET`

## Troubleshooting

If you see errors about missing environment variables:
1. Check that `.env` exists in the `server/` directory
2. Verify all required variables are set
3. Restart the server after changing `.env`

