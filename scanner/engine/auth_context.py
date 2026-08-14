"""
Authentication Context — centralized, configurable authentication.

Supports: cookies, Bearer tokens, JWT, custom headers, API keys.
Supports two-user context for IDOR/BOLA testing.
Never prints/logs credentials or tokens.
"""

import os
import requests
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum


class AuthMethod(Enum):
    """Supported authentication methods."""
    NONE = "none"
    BEARER_TOKEN = "bearer_token"
    COOKIE = "cookie"
    API_KEY = "api_key"
    CUSTOM_HEADER = "custom_header"
    BASIC = "basic"


class AuthState(Enum):
    """Current authentication state."""
    NOT_ATTEMPTED = "not_attempted"
    AUTHENTICATED = "authenticated"
    FAILED = "failed"
    NOT_REQUIRED = "not_required"


@dataclass
class UserCredentials:
    """Credentials for a single user (never exposed in logs/reports)."""
    identifier: str = ""  # email, username, etc.
    secret: str = ""      # password, api key, etc.
    token: str = ""       # acquired auth token
    cookies: Dict[str, str] = field(default_factory=dict)
    custom_headers: Dict[str, str] = field(default_factory=dict)
    auth_method: AuthMethod = AuthMethod.NONE
    state: AuthState = AuthState.NOT_ATTEMPTED
    label: str = "user"   # "user_a" or "user_b" for IDOR testing

    def get_auth_headers(self) -> Dict[str, str]:
        """Return headers needed for authenticated requests."""
        headers = {}
        if self.auth_method == AuthMethod.BEARER_TOKEN and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        elif self.auth_method == AuthMethod.API_KEY and self.secret:
            headers["X-API-Key"] = self.secret
        elif self.auth_method == AuthMethod.CUSTOM_HEADER:
            headers.update(self.custom_headers)
        return headers


class AuthContext:
    """Manages authentication state for the scanner.

    Supports configurable login endpoints, multiple auth methods,
    and two-user context for IDOR testing.
    """

    def __init__(
        self,
        login_url: Optional[str] = None,
        login_endpoints: Optional[List[str]] = None,
    ):
        self.login_url = login_url
        self.login_endpoints = login_endpoints or []
        self.user_a = UserCredentials(label="user_a")
        self.user_b = UserCredentials(label="user_b")
        self._active_user: UserCredentials = self.user_a

    @classmethod
    def from_env(cls, base_url: str) -> "AuthContext":
        """Create auth context from environment variables."""
        ctx = cls()

        # User A (primary test user)
        ctx.user_a.identifier = os.getenv("TEST_EMAIL", "")
        ctx.user_a.secret = os.getenv("TEST_PASSWORD", "")

        # User B (secondary user for IDOR testing)
        ctx.user_b.identifier = os.getenv("TEST_EMAIL_B", "")
        ctx.user_b.secret = os.getenv("TEST_PASSWORD_B", "")

        # Pre-configured tokens (skip login)
        token_a = os.getenv("TEST_TOKEN", "")
        if token_a:
            ctx.user_a.token = token_a
            ctx.user_a.auth_method = AuthMethod.BEARER_TOKEN
            ctx.user_a.state = AuthState.AUTHENTICATED

        token_b = os.getenv("TEST_TOKEN_B", "")
        if token_b:
            ctx.user_b.token = token_b
            ctx.user_b.auth_method = AuthMethod.BEARER_TOKEN
            ctx.user_b.state = AuthState.AUTHENTICATED

        # API key auth
        api_key = os.getenv("TEST_API_KEY", "")
        if api_key:
            ctx.user_a.secret = api_key
            ctx.user_a.auth_method = AuthMethod.API_KEY
            ctx.user_a.state = AuthState.AUTHENTICATED

        # Custom login endpoints
        custom_login = os.getenv("LOGIN_URL", "")
        if custom_login:
            ctx.login_url = custom_login
        else:
            ctx.login_endpoints = [
                f"{base_url}/api/login",
                f"{base_url}/login",
                f"{base_url}/auth/login",
                f"{base_url}/api/auth/login",
            ]

        return ctx

    def attempt_login(self, session: requests.Session, user: Optional[UserCredentials] = None) -> bool:
        """Attempt to authenticate a user via login endpoints.

        Returns True if authentication succeeded.
        """
        user = user or self.user_a
        if user.state == AuthState.AUTHENTICATED:
            return True

        if not user.identifier or not user.secret:
            user.state = AuthState.FAILED
            return False

        endpoints = [self.login_url] if self.login_url else self.login_endpoints
        login_data = {"email": user.identifier, "password": user.secret}

        for endpoint in endpoints:
            if not endpoint:
                continue
            try:
                resp = session.post(endpoint, json=login_data, timeout=10)
                if resp.status_code == 200:
                    try:
                        resp_json = resp.json()
                        token = (
                            resp_json.get("token")
                            or resp_json.get("access_token")
                            or resp_json.get("jwt")
                            or resp_json.get("data", {}).get("token", "")
                        )
                        if token:
                            user.token = token
                            user.auth_method = AuthMethod.BEARER_TOKEN
                            user.state = AuthState.AUTHENTICATED
                            return True
                    except (ValueError, AttributeError):
                        pass

                    # Check for session cookies
                    if session.cookies:
                        user.cookies = dict(session.cookies)
                        user.auth_method = AuthMethod.COOKIE
                        user.state = AuthState.AUTHENTICATED
                        return True

                    # 200 but no token/cookies — may still be authenticated
                    user.state = AuthState.AUTHENTICATED
                    user.auth_method = AuthMethod.COOKIE
                    return True

            except Exception:
                continue

        user.state = AuthState.FAILED
        return False

    def apply_auth(self, session: requests.Session, user: Optional[UserCredentials] = None):
        """Apply authentication headers/cookies to a session."""
        user = user or self.user_a
        auth_headers = user.get_auth_headers()
        if auth_headers:
            session.headers.update(auth_headers)
        if user.cookies:
            for name, value in user.cookies.items():
                session.cookies.set(name, value)

    def create_session_for_user(self, user: UserCredentials) -> requests.Session:
        """Create a new requests session authenticated as a specific user."""
        session = requests.Session()
        self.apply_auth(session, user)
        return session

    @property
    def is_authenticated(self) -> bool:
        return self.user_a.state == AuthState.AUTHENTICATED

    @property
    def has_two_users(self) -> bool:
        return (
            self.user_a.state == AuthState.AUTHENTICATED
            and self.user_b.state == AuthState.AUTHENTICATED
        )

    def get_summary(self) -> dict:
        """Summary without exposing credentials."""
        return {
            "user_a": {
                "state": self.user_a.state.value,
                "method": self.user_a.auth_method.value,
                "has_token": bool(self.user_a.token),
            },
            "user_b": {
                "state": self.user_b.state.value,
                "method": self.user_b.auth_method.value,
                "has_token": bool(self.user_b.token),
            },
            "two_user_testing": self.has_two_users,
        }
