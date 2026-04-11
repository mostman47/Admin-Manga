# Local Setup Instructions

To run this application locally and use the **Advanced Playwright Crawler** (which bypasses robot checkers and hotlink protection), follow these steps:

## Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**

## 1. Clone/Download the project
Extract the project files to a folder on your computer.

## 2. Install Dependencies
Open your terminal in the project folder and run:
```bash
npm install
```

## 3. Install Playwright Browsers
The Advanced Crawler requires Chromium to be installed on your system:
```bash
npx playwright install chromium
```

## 4. Set Environment Variables
Create a `.env` file in the root directory and add your Gemini API key:
```env
GEMINI_API_KEY=your_api_key_here
```

## 5. Start the Application
Run the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## Why use Local Mode?
- **Bypass Robot Checkers**: Local browsers have a better "reputation" than cloud servers, making it easier to pass Cloudflare/DDoS checks.
- **Solve Challenges Manually**: If you see a "Sorry, you have been blocked" message, you can toggle **Headless: OFF** in the app. This will open a visible browser window on your computer where you can manually click "I am human" or solve any Captchas.
- **Screenshot Crawling**: The Advanced Mode renders the page exactly as you see it and takes "pixel-perfect" screenshots of the manga pages, which completely bypasses hotlink protection (403 errors).
- **Debug View**: If the crawler fails to find images, it will now show you a **Debug Screenshot** of what it actually saw, helping you diagnose if the page was blocked or redirected.
