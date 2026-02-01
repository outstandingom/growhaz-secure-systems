-- Update blog posts to have correct categories based on their content
UPDATE blog_posts 
SET category = 'security' 
WHERE title ILIKE '%security%' OR title ILIKE '%vulnerabilit%' OR tags::text ILIKE '%security%' OR tags::text ILIKE '%cybersecurity%';

UPDATE blog_posts 
SET category = 'seo' 
WHERE (title ILIKE '%SEO%' OR tags::text ILIKE '%SEO%') AND category = 'general';

UPDATE blog_posts 
SET category = 'ai-agents' 
WHERE (title ILIKE '%AI%' OR title ILIKE '%automat%' OR tags::text ILIKE '%AI%' OR tags::text ILIKE '%automation%') AND category = 'general';