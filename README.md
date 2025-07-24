# Ask AI API

## Production Deployment Steps

### 1. Set up Vercel Account
1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Connect your GitHub account

### 2. Deploy from CLI
```bash
vercel
```

### 3. Set Environment Variables in Vercel
After deployment, add these environment variables in your Vercel dashboard:
- `GROQ_API_KEY`: Your Groq API key
- `NODE_ENV`: production

### 4. Your API will be available at:
```
https://your-project-name.vercel.app/api/ask-ai
```

## Local Testing

### Start local development:
```bash
vercel dev
```

## API Endpoints

### POST /api/ask-ai
- **Body**: `{ "prompt": "Your question here" }`
- **Response**: `{ "response": "AI generated response" }`

## Postman Testing

Import the included Postman collection for easy testing.
