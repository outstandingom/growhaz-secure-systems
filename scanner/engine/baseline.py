"""
Baseline response measurement using statistical comparison.

Collects multiple samples, calculates median and variance for
reliable time-based and response-based comparisons.
"""

import time
import statistics
from dataclasses import dataclass, field
from typing import Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .request_engine import RequestEngine


@dataclass
class BaselineProfile:
    """Statistical profile of normal responses for an endpoint."""
    response_times: List[float] = field(default_factory=list)
    status_codes: List[int] = field(default_factory=list)
    response_lengths: List[int] = field(default_factory=list)
    response_bodies: List[str] = field(default_factory=list)

    @property
    def median_time(self) -> float:
        return statistics.median(self.response_times) if self.response_times else 1.0

    @property
    def time_stddev(self) -> float:
        return statistics.stdev(self.response_times) if len(self.response_times) >= 2 else 0.5

    @property
    def median_length(self) -> int:
        return int(statistics.median(self.response_lengths)) if self.response_lengths else 0

    @property
    def length_stddev(self) -> float:
        return statistics.stdev(self.response_lengths) if len(self.response_lengths) >= 2 else 0.0

    @property
    def dominant_status(self) -> int:
        if not self.status_codes:
            return 0
        return max(set(self.status_codes), key=self.status_codes.count)

    @property
    def sample_count(self) -> int:
        return len(self.response_times)

    def is_time_anomalous(self, elapsed: float, threshold_factor: float = 3.0) -> bool:
        """Check if a response time is statistically anomalous."""
        if self.sample_count < 2:
            return elapsed > self.median_time * 3
        return elapsed > self.median_time + (self.time_stddev * threshold_factor)

    def is_length_anomalous(self, length: int, threshold_factor: float = 3.0) -> bool:
        """Check if a response length is statistically anomalous."""
        if self.sample_count < 2:
            return abs(length - self.median_length) > self.median_length * 0.5
        deviation = abs(length - self.median_length)
        return deviation > max(self.length_stddev * threshold_factor, 50)

    def response_similarity(self, body: str) -> float:
        """Calculate similarity of a response body to baseline bodies (0.0–1.0)."""
        if not self.response_bodies or not body:
            return 0.0
        # Use simple set-based similarity (Jaccard on words)
        body_words = set(body.lower().split())
        similarities = []
        for baseline_body in self.response_bodies:
            baseline_words = set(baseline_body.lower().split())
            if not body_words and not baseline_words:
                similarities.append(1.0)
                continue
            union = body_words | baseline_words
            if not union:
                similarities.append(1.0)
                continue
            intersection = body_words & baseline_words
            similarities.append(len(intersection) / len(union))
        return max(similarities) if similarities else 0.0


class BaselineMeasurer:
    """Collects baseline response profiles for endpoints."""

    def __init__(self, default_samples: int = 5):
        self.default_samples = default_samples
        self._cache: Dict[str, BaselineProfile] = {}

    def get_baseline(
        self,
        engine: "RequestEngine",
        url: str,
        method: str = "GET",
        data: Optional[dict] = None,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None,
        samples: Optional[int] = None,
    ) -> BaselineProfile:
        """Get or measure a baseline profile for an endpoint.

        Returns cached profile if already measured.
        """
        cache_key = f"{method}:{url}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        samples = samples or self.default_samples
        profile = BaselineProfile()

        for _ in range(samples):
            result = engine.request(
                method=method,
                url=url,
                data=data,
                json=json_data,
                params=params,
            )

            if result.has_response and not result.is_blocked:
                profile.response_times.append(result.elapsed)
                profile.status_codes.append(result.status_code)
                profile.response_lengths.append(len(result.body))
                # Store only first 2 bodies to save memory
                if len(profile.response_bodies) < 2:
                    profile.response_bodies.append(result.body[:1000])

        self._cache[cache_key] = profile
        return profile

    def clear_cache(self):
        """Clear all cached baselines."""
        self._cache.clear()
