-- Migration to add the Firebase Push Notifications setup guide blog post
INSERT INTO public.blog_posts (
  id,
  title,
  slug,
  excerpt,
  content,
  featured_image,
  author_name,
  tags,
  category,
  meta_description,
  is_published,
  published_at
) VALUES (
  'e63b610e-0ef7-47be-b217-cb391e0a94b5',
  'How to Set Up Firebase Push Notifications for GrowHaz Web-to-App Converter',
  'how-to-setup-firebase-push-notifications-growhaz',
  'Learn how to get both google-services.json and Firebase Admin Service Account Key JSON to enable reliable background push notifications in your converted Android APK.',
  '## Why Push Notifications Need Firebase on Android

When converting a website into a mobile application, one of the biggest benefits is the ability to send push notifications directly to user devices.

However, standard web browsers and mobile apps handle push notifications very differently:

- **Inside the browser:** When a user visits your website in Chrome, standard Web Push (Service Workers) can show notifications.
- **Inside a mobile app (WebView):** When the user switches to another app, turns off their screen, or swipes the app away from their recent apps list, Android OS puts the WebView to sleep or terminates it completely to conserve battery and memory.
- **The result:** Standard web notifications stop working the moment your app is in the background.

To deliver push notifications when the app is closed or backgrounded, Android requires **Firebase Cloud Messaging (FCM)** running at the native OS level. Android''s built-in Google Play Services maintains a constant low-power connection to Google servers and wakes up your app''s notification handler (`MyFirebaseMessagingService`) whenever a notification arrives.

---

## The Two Files You Need

To enable native FCM push notifications in GrowHaz, you need to provide **two JSON files** from your free Firebase project:

1. **`google-services.json` (Client Configuration)**
   - **What it is:** Contains your Firebase project identifiers, API keys, and client credentials.
   - **Where it goes:** Baked directly into the Android APK (`app/google-services.json`).
   - **Why it is needed:** The Android operating system uses this file on device startup to connect to Google Firebase servers and obtain a unique device push registration token.

2. **Firebase Admin Service Account Private Key JSON (Server Key)**
   - **What it is:** A secure private cryptographic key that authenticates your backend push server with Google Cloud.
   - **Where it goes:** Sent to the Push Notification Server. It is **never** embedded inside the APK for security reasons.
   - **Why it is needed:** When you want to send a notification to your users, the push server uses this private key to authorize requests to the Firebase Cloud Messaging HTTP v1 API.

---

## Step 1: Create a Free Firebase Project

1. Navigate to the [Google Firebase Console](https://console.firebase.google.com/).
2. Sign in with your Google account.
3. Click **Add project** (or select an existing project if you already have one).
4. Enter a project name (for example, `My App Notifications`) and click **Continue**.
5. You can disable or enable Google Analytics depending on your preference, then click **Create project**.
6. Wait 10 seconds for Firebase to prepare your workspace, then click **Continue**.

---

## Step 2: Register Android App & Download `google-services.json`

1. On your Firebase Project Overview dashboard, click the **Android icon** (or click **Add app** > **Android**).
2. **Crucial Step — Android Package Name:**
   - In GrowHaz Web-to-App Converter, check the **Package Name** assigned to your app (for example: `com.growhaz.mybrand` or your custom package name).
   - Copy this exact package name and paste it into the **Android package name** field in Firebase.
   - *Note:* If the package name in Firebase does not match the package name of the APK, Firebase will reject device registration.
3. (Optional) Enter an App nickname (e.g. `My Website App`).
4. Click **Register app**.
5. Click the blue **Download google-services.json** button.
6. Keep this file safe on your computer. You will upload this in GrowHaz!
7. You can skip the rest of the steps in the Firebase wizard since GrowHaz''s automated builder configures the Gradle dependencies automatically.

---

## Step 3: Generate Firebase Service Account Key JSON

Now, generate the server-side private key that allows the push server to dispatch messages:

1. In the Firebase Console, click the **Gear icon (Project settings)** next to *Project Overview* in the left sidebar.
2. In the top tabs, select **Service accounts**.
3. Under the **Firebase Admin SDK** section, confirm the language is selected as Node.js.
4. Click the blue button labeled **Generate new private key**.
5. A confirmation modal will appear warning you to keep this key confidential. Click **Generate key**.
6. A JSON file will download to your computer named `your-project-firebase-adminsdk-xxxxx.json`.
7. This is your **Firebase service account key**.

---

## Step 4: Upload to GrowHaz & Build Your APK

1. Go to GrowHaz Web-to-App Converter.
2. Enter your Website URL and App Name.
3. Select the **Advanced** or **Pro** plan.
4. Toggle on **Enable Push Notifications**.
5. Upload your downloaded `google-services.json` into the first upload field.
6. Upload your `your-project-firebase-adminsdk-*.json` into the second upload field.
7. Click **Build APK**. GrowHaz will compile your native Android project with FCM integrated, register your app with the push server, and generate your download link!

---

## What If You Want Minimal Changes / Zero Config?

If you do **not** need push notifications right away, you do **not** need Firebase at all!

- Simply leave **Enable Push Notifications** unchecked.
- Enter your **Website URL** and **App Name**.
- Your APK will compile in under 2 minutes with **zero configuration**, no third-party accounts, and no files to download or upload.
- You can always upgrade and add push notifications later whenever you are ready!

---

## How Push Notifications Work After Build

1. When a user installs and opens your APK, Android generates an FCM device token.
2. The APK automatically registers this token with the Push Notification Server.
3. When you want to send a notification (promotional announcement, user alert, new post), you trigger the push server''s `/api/push/broadcast` endpoint with your message title, body, and URL.
4. Firebase delivers the notification immediately to all devices — whether the app is active, closed, or the user is using another app.',
  'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&w=1200&q=80',
  'GrowHaz Engineering Team',
  ARRAY['Android', 'Firebase', 'FCM', 'Push Notifications', 'Web to App', 'Mobile Development'],
  'development',
  'Step-by-step guide to configure Firebase Cloud Messaging (FCM) and download google-services.json and private key for GrowHaz Web-to-App builder.',
  true,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  category = EXCLUDED.category,
  meta_description = EXCLUDED.meta_description,
  is_published = true;
