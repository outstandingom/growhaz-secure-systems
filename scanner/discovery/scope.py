"""
Target Scope & Origin Classifier.

Differentiates:
1. Target Application Endpoints (In-Scope for crawling and security testing):
   - Same origin / domain & subdomains (e.g. target.com, api.target.com)
   - Discovered Backend-as-a-Service (BaaS) and cloud API backends used by the app:
     - Supabase project hosts (*.supabase.co)
     - Firebase project hosts (*.firebaseio.com, identitytoolkit.googleapis.com)
     - Cloud backends (*.onrender.com, *.railway.app, *.fly.dev, *.herokuapp.com, *.azurewebsites.net)
     - Any host where the frontend attaches API auth headers (apikey, authorization, x-api-key)
     - Any host with API route prefixes (/rest/v1/, /api/, /graphql, /trpc/)
2. External Third-Party Tracking / Telemetry / CDNs (Out-of-Scope, ignored):
   - Google Analytics, Google Tag Manager, DoubleClick
   - Facebook/Meta Pixel
   - Microsoft Clarity, Hotjar, Segment, Mixpanel
   - Sentry, Datadog, Crisp, Intercom
   - CDNs: cdnjs, unpkg, jsdelivr, google fonts, cloudflare insights
"""

from urllib.parse import urlparse
from typing import Dict, Optional, Set

THIRD_PARTY_IGNORE_HOSTS: Set[str] = {
    # Analytics & Telemetry
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "analytics.google.com",
    "facebook.com",
    "facebook.net",
    "connect.facebook.net",
    "instagram.com",
    "clarity.ms",
    "hotjar.com",
    "segment.io",
    "segment.com",
    "mixpanel.com",
    "heapanalytics.com",
    "amplitude.com",
    "fullstory.com",
    # Error tracking & chat widgets
    "sentry.io",
    "browser.sentry-cdn.com",
    "datadoghq.com",
    "intercom.io",
    "intercomcdn.com",
    "crisp.chat",
    "drift.com",
    "zendesk.com",
    "freshchat.com",
    # CDNs and static asset hosts
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdn.jsdelivr.net",
    "cdnjs.cloudflare.com",
    "unpkg.com",
    "static.cloudflareinsights.com",
    "cloudflareinsights.com",
    "gravatar.com",
    "github.githubassets.com",
}

BACKEND_PLATFORM_SUFFIXES = (
    ".supabase.co",
    ".firebaseio.com",
    ".cloudfunctions.net",
    ".onrender.com",
    ".railway.app",
    ".fly.dev",
    ".herokuapp.com",
    ".azurewebsites.net",
    ".elasticbeanstalk.com",
)

AUTH_HEADER_KEYS = (
    "apikey",
    "authorization",
    "x-api-key",
    "x-supabase-auth",
    "x-auth-token",
)


def is_target_scope(url: str, base_url: str, headers: Optional[Dict[str, str]] = None) -> bool:
    """
    Determine if a URL belongs to the target application's attack surface.
    
    Returns True for:
      - Same origin & subdomains of base_url
      - Backend APIs (Supabase, Firebase, Render, Fly, etc.) used by the app
      - Endpoints called with application auth/API keys
      
    Returns False for:
      - Third-party analytics (Google Analytics, Clarity, etc.)
      - Third-party CDNs and font hosts
    """
    if not url:
        return False

    try:
        parsed = urlparse(url)
        netloc = (parsed.netloc or "").lower()
        if not netloc:
            # Relative URL is always same host
            return True

        host = netloc.split(":")[0]

        # 1. Reject third-party trackers & CDNs
        for ignore in THIRD_PARTY_IGNORE_HOSTS:
            if host == ignore or host.endswith("." + ignore):
                return False

        # 2. Check same host or subdomain
        target_netloc = urlparse(base_url).netloc.lower().split(":")[0]
        a = host[4:] if host.startswith("www.") else host
        b = target_netloc[4:] if target_netloc.startswith("www.") else target_netloc
        if a == b or a.endswith("." + b) or b.endswith("." + a):
            return True

        # 3. Check known BaaS / Cloud backend platforms
        for suffix in BACKEND_PLATFORM_SUFFIXES:
            if host.endswith(suffix):
                return True

        # 4. Check if request was sent with custom API/auth headers
        if headers:
            for k in headers.keys():
                if k.lower() in AUTH_HEADER_KEYS:
                    return True

        # 5. Check route prefix for API structure
        path_lower = (parsed.path or "").lower()
        if any(path_lower.startswith(p) for p in ("/rest/v1", "/api/", "/v1/", "/v2/", "/graphql", "/trpc/")):
            return True

        return False
    except Exception:
        return False
