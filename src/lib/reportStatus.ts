/**
 * A scan report is viewable as soon as the scanner has written its data.
 * The AlphaG5 engine can finish as "completed", "completed_with_issues" or
 * "incomplete" (some detectors blocked by a WAF) — all of these still produce
 * a full report, so all of them must be downloadable by the user.
 */
export const isReportReady = (status?: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.startsWith("completed") || s === "incomplete" || s === "done";
};
