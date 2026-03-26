# ⚡ FXSynapse AI — Setup Guide

Follow these steps IN ORDER and you'll have the app running.

---

## STEP 1 — Install Node.js (if you haven't already)

1. Go to https://nodejs.org
2. Download the "LTS" version (the green button)
3. Install it (just click Next through the installer)
4. To confirm it worked, open VSCode and press:
   Ctrl + ` (backtick key, top-left of keyboard)
   This opens the Terminal. Type:
   node --version
   You should see something like: v20.x.x

---

## STEP 2 — Open this folder in VSCode

1. Open VSCode
2. Click File → Open Folder
3. Select the "fxsynapse" folder you just downloaded
4. Click "Yes, I trust the authors" if a popup appears

---

## STEP 3 — Install the project dependencies

In the VSCode Terminal (Ctrl + `), type:

   npm install

Wait for it to finish. You'll see a "node_modules" folder appear.

---

## STEP 4 — Create your Supabase account (free)

1. Go to https://supabase.com and click "Start your project"
2. Sign up for a free account
3. Click "New Project"
4. Give it a name like "fxsynapse" and choose a region close to you
5. Wait ~2 minutes for it to set up
6. Once ready, click "Settings" (gear icon, left sidebar)
7. Click "API"
8. You'll see two things you need:
   - "Project URL"  → looks like: https://abcdefgh.supabase.co
   - "anon public"  → a long string starting with "eyJ..."
   Copy both of these.

---

## STEP 5 — Create your .env file

1. In VSCode, look at the file list on the left
2. You'll see a file called ".env.example"
3. Right-click it → "Copy"
4. Right-click the empty space in the file list → "Paste"
5. Rename the copy from ".env.example" to ".env"
6. Open ".env" and replace the placeholder values:

   VITE_SUPABASE_URL=paste_your_project_url_here
   VITE_SUPABASE_ANON_KEY=paste_your_anon_key_here

7. Save the file (Ctrl + S)

---

## STEP 6 — Run the app

In the Terminal, type:

   npm run dev

You should see:
   ➜  Local:   http://localhost:5173/

Hold Ctrl and click that link, or open your browser and go to:
   http://localhost:5173

Your app is now running! 🎉

---

## STEP 7 — Test sign up & sign in

1. Click "Sign Up" and create a test account with your email
2. Check your email for a confirmation link and click it
3. Sign in — you'll land on the FXSynapse dashboard
4. Upload a chart image and click "Analyze Chart"

---

## FOLDER STRUCTURE (what each file does)

fxsynapse/
├── index.html                 ← The main HTML file (don't touch this)
├── vite.config.js             ← Vite build tool config (don't touch this)
├── package.json               ← Lists all the packages the app uses
├── .env                       ← YOUR SECRET KEYS (never share this!)
├── .env.example               ← Template showing what .env should look like
└── src/
    ├── main.jsx               ← Entry point — starts the React app
    ├── App.jsx                ← Sets up routing + auth session listener
    ├── index.css              ← Global styles and CSS variables
    ├── supabase.js            ← Connects to your Supabase project
    └── pages/
        ├── AuthPage.jsx       ← Sign In / Sign Up page
        ├── AuthPage.module.css
        ├── Dashboard.jsx      ← Main chart analysis app
        └── Dashboard.module.css

---

## DEPLOYING TO THE WEB (optional, free)

When you're ready to share your app publicly:

1. Push your code to GitHub (google "how to push to GitHub with VSCode")
2. Go to https://vercel.com and sign up free
3. Click "Add New Project" → import your GitHub repo
4. Under "Environment Variables", add:
   VITE_SUPABASE_URL     = your value
   VITE_SUPABASE_ANON_KEY = your value
5. Click Deploy
6. Vercel gives you a free URL like: https://fxsynapse.vercel.app

---

## COMMON ERRORS

"Cannot find module" or "npm not found"
→ Node.js is not installed. See Step 1.

"Missing Supabase URL"
→ You forgot to create the .env file. See Step 5.

"Invalid API key"
→ Double-check you copied the right Supabase keys in .env

The page loads but sign-in doesn't work
→ Make sure you confirmed your email after signing up

---

That's it! You now have a full-stack AI web app with authentication. 🚀
