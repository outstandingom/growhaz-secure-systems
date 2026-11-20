import { BETUL_AUTOMATION_ARTICLE } from "./aiAutomationBetul";

export interface FallbackBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  author_name: string;
  tags: string[];
  category: string;
  meta_description: string | null;
  published_at: string;
}

export const FALLBACK_BLOG_POSTS: FallbackBlogPost[] = [
  {
    id: BETUL_AUTOMATION_ARTICLE.id,
    title: BETUL_AUTOMATION_ARTICLE.title,
    slug: BETUL_AUTOMATION_ARTICLE.slug,
    excerpt: BETUL_AUTOMATION_ARTICLE.excerpt,
    content: BETUL_AUTOMATION_ARTICLE.content,
    featured_image: BETUL_AUTOMATION_ARTICLE.image || null,
    author_name: BETUL_AUTOMATION_ARTICLE.author,
    tags: [...BETUL_AUTOMATION_ARTICLE.tags],
    category: BETUL_AUTOMATION_ARTICLE.category,
    meta_description: BETUL_AUTOMATION_ARTICLE.description,
    published_at: `${BETUL_AUTOMATION_ARTICLE.publishedAt}T00:00:00Z`,
  },
  {
    id: "firebase-push-guide-growhaz",
    title: "How to Build Your Android APK with Dedicated Firebase Push Notifications: What We Need from You",
    slug: "how-to-setup-firebase-push-notifications-growhaz",
    excerpt: "A complete step-by-step guide for clients and website owners: how to set up your own Firebase project, register your app's package name, download the two required Google JSON files, and convert your website into a native Android APK with 100% private push notifications.",
    featured_image: "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&w=1200&q=80",
    author_name: "GrowHaz Engineering Team",
    tags: ["Android", "Web to App", "Firebase", "Push Notifications", "APK", "FCM", "Custom Credentials"],
    category: "development",
    meta_description: "Learn how to provide your own Firebase credentials and package name to build a custom Android APK with dedicated, private push notifications using GrowHaz Appify.",
    published_at: "2026-11-20T00:00:00Z",
    content: `## Dedicated Push Notifications: Why You Bring Your Own Firebase

When converting your website into an Android application with **GrowHaz Appify**, we do not force you into a shared, generic push notification pool. 

Instead, our architecture gives every client **100% dedicated ownership**:
- **Your Own Firebase Project:** Every notification is delivered through your own Google Cloud & Firebase project.
- **Complete Privacy & Data Isolation:** Your subscriber tokens, user device IDs, and campaign analytics remain entirely yours.
- **Zero Quota Limits:** You are never throttled by other users' sending volumes.
- **Full Direct Control:** You can monitor message deliveries, open rates, and device stats directly inside your own Google Firebase Console.

Because your app is tied directly to your own Firebase project, **you need to provide your custom Package Name and two configuration files from your Firebase account**.

This guide walks you through **what we need from you**, **the exact connection between your package name and Firebase**, and **where to download both files in under 5 minutes**.

---

## The Core Rule: The Package Name Connection

Before downloading any files, understand the single most important rule of Android & Firebase:

> **The Android Package Name you enter in Appify MUST match the Package Name you enter in your Firebase Console.**

\`\`\`
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     GrowHaz Appify Form         │           │     Google Firebase Console     │
│                                 │           │                                 │
│ Package Name:                   │  ◀─────▶  │ Android Package Name:           │
│ com.yourcompany.app             │   MATCH   │ com.yourcompany.app             │
└─────────────────────────────────┘           └─────────────────────────────────┘
\`\`\`

If your package name in Appify is \`com.mybrand.store\`, your Android app inside Firebase must also be registered as \`com.mybrand.store\`. If they don't match, Google will reject push messages at the device level.

---

## Checklist: Everything Needed From You

To compile your custom APK and connect your dedicated push pipeline, we need 6 items:

| # | Item Needed | What It Does | Where You Get It |
|---|---|---|---|
| **1** | **Target Website URL** | The site wrapped into the native app | Your browser address bar (\`https://yourdomain.com\`) |
| **2** | **App Name** | Title displayed on the phone launcher | Your brand name (e.g. \`My Store\`) |
| **3** | **Package Name** | Unique Android Application ID | Reverse domain notation (\`com.yourcompany.app\`) |
| **4** | **App Icon / Logo** | Square launcher icon (512×512 PNG) | Your logo file / design export |
| **5** | **File 1: \`google-services.json\`** | Client config baked into the APK | Downloaded from your Firebase Console (Android App) |
| **6** | **File 2: Firebase Service Account JSON** | Private key used to send notifications | Downloaded from your Firebase Console (Service Accounts) |

---

## Step-by-Step: How to Set Up Your Firebase & Get Both Files

Follow these exact steps in your own Google Firebase Console.

### Step 1: Create or Open Your Firebase Project
1. Open your browser and go to the **[Google Firebase Console](https://console.firebase.google.com/)**.
2. Sign in with your company or personal Google account.
3. Click **Add project** (or select your existing project). 
4. Enter a name for your project (e.g., "MyBrand Mobile App") and click **Continue** until the project dashboard opens.

---

### Step 2: Register Your Android App & Download File 1 (\`google-services.json\`)

This file is the **client configuration**. It gets compiled inside your Android APK so user devices can register with Firebase Cloud Messaging (FCM).

\`\`\`
Firebase Dashboard ──▶ Click Android Icon ──▶ Enter Package Name ──▶ Click Register ──▶ Download google-services.json
\`\`\`

1. On your Firebase Project Overview page, click the **Android icon** (or click **+ Add app** and choose Android).
2. In the **Android package name** field, enter your desired package name:
   - Example: \`com.mycompany.app\`
   - *Remember: This must match the Package Name you enter in GrowHaz Appify!*
3. *(Optional)* Enter an App nickname (e.g. "My Website App").
4. Click the blue **Register app** button.
5. In Step 2 ("Download config file"), click the big blue button: **Download google-services.json**.
6. Save this file to your computer.
7. Click through the remaining steps (**Next** ➔ **Next** ➔ **Continue to console**).

---

### Step 3: Generate & Download File 2 (Firebase Admin Service Account JSON)

This file contains your **private administrative credentials**. 

Google's modern FCM v1 API requires server authentication via an OAuth2 Service Account to dispatch push notifications. Appify uses this file to configure your dedicated dispatch worker so you can trigger real-time alerts to your app users.

\`\`\`
Firebase Console ──▶ Gear Icon ⚙️ (Project settings) ──▶ Service accounts tab ──▶ Click "Generate new private key"
\`\`\`

1. In the Firebase Console, look at the top of the left sidebar.
2. Click the **Gear icon (⚙️)** next to *Project Overview* and select **Project settings**.
3. In the top navigation tabs, click **Service accounts**.
4. Confirm that **Firebase Admin SDK** is highlighted.
5. Scroll down to the bottom of the page and click the blue button: **Generate new private key**.
6. A confirmation dialog will pop up: *"Generate a private key for your service account?"*
7. Click **Generate key**.
8. A \`.json\` file will download to your computer. The filename will look like:
   \`myproject-firebase-adminsdk-xxxxx-xxxxxxxxxx.json\`
9. Keep this file safe.

---

## Step 4: Enter Details and Upload Both Files in GrowHaz Appify

Now that you have your package name and both Google files:

1. Open **[GrowHaz Appify](https://www.growhaz.in/automation)**.
2. **Website URL:** Paste your live site link (\`https://yourdomain.com\`).
3. **App Name:** Type your app's display name.
4. **Package Name:** Enter the **exact same package name** you registered in Firebase (e.g., \`com.mycompany.app\`).
5. **App Icon:** Upload your square 512×512 logo.
6. Toggle **Push Notifications** ON:
   - Under **1. Google Services JSON**, click **Upload google-services.json** and select File 1.
   - Under **2. Firebase Service Account Key**, click **Upload Firebase Service Account JSON** and select File 2.
7. Click **Generate APK**.

---

## What Happens Behind the Scenes?

Once you submit your build:

1. **Package Verification:** Appify cross-checks the package name inside your \`google-services.json\` against the package name specified for the build, ensuring 100% alignment.
2. **Native Android Compilation:** Appify places your \`google-services.json\` into the native Android \`app/\` directory and sets up the Firebase Messaging background receivers.
3. **Dedicated Push Registration:** The Appify backend registers your Firebase Service Account credentials under your unique \`appId\` (\`com.yourcompany.app\`).
4. **Gradle Cloud Build:** The Android Gradle build engine compiles the native APK (\`.apk\`) and Play Store bundle (\`.aab\`) with hardware acceleration and push notification support enabled.
5. **Instant Delivery:** You receive a direct download link for your compiled Android APK.

---

## How You Send Push Notifications to Your Users

Because you provided your own Firebase Service Account, you can trigger notifications at any time directly through your dedicated push API endpoint:

\`\`\`bash
curl -X POST https://api.growhaz.in/api/send \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "appId": "com.mycompany.app",
    "title": "New Order Received! 📦",
    "body": "Customer #4092 just completed checkout.",
    "url": "https://yourdomain.com/dashboard/orders"
  }'
\`\`\`

The push server uses **YOUR** Firebase Service Account to authenticate with Google FCM v1, and Google delivers the notification directly to all Android phones running your app—even when the app is completely closed.

---

## Summary: Complete Ownership, Zero Confusion

By supplying your own Firebase credentials and Package Name:
- You retain complete ownership of your mobile app users and notification tokens.
- Your app communicates directly with your own Google Cloud infrastructure.
- GrowHaz handles 100% of the complex Android compilation, Gradle builds, manifest permissions, and native bridges automatically.`
  }
];
