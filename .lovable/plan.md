# Founder page search visibility

## Goal
Make Om Uikey’s existing founder page easy for Google and AI answer agents to identify and crawl, without redesigning other pages.

## Changes
- Display the founder photo provided by the user on `/founder/om-uikey`.
- Generate a static, crawler-readable founder page during the existing post-build prerender step, with page-specific title, description, canonical URL, and Person/ProfilePage structured data.
- Make the founder’s role at GrowHaz and his work in blockchain document verification, adaptive firewall/cybersecurity, AI automation, and practical problem-solving explicit in the page content.
- Clarify the existing AI crawler permissions in `robots.txt` and ensure the founder page remains in the generated sitemap and `llms.txt`.

## Technical details
- Preserve the current React page and existing post-build prerender/sitemap mechanism; do not add a backend, database changes, or broad site redesign.
- Verify generated founder HTML, metadata, structured data, crawler directives, and the normal project build.
