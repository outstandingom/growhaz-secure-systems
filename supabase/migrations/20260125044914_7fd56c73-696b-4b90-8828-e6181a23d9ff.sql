-- Create blog_posts table
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  featured_image TEXT,
  author_name TEXT NOT NULL DEFAULT 'GROWHAZ Team',
  tags TEXT[] DEFAULT '{}',
  meta_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts
CREATE POLICY "Anyone can view published blog posts"
ON public.blog_posts
FOR SELECT
USING (is_published = true);

-- Create index for faster slug lookups
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);

-- Create index for published posts ordered by date
CREATE INDEX idx_blog_posts_published ON public.blog_posts(published_at DESC) WHERE is_published = true;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample blog posts for demonstration
INSERT INTO public.blog_posts (title, slug, excerpt, content, author_name, tags, meta_description, is_published, published_at)
VALUES 
(
  'Top 10 Website Security Vulnerabilities in 2025',
  'top-10-website-security-vulnerabilities-2025',
  'Discover the most critical security vulnerabilities threatening websites in 2025 and learn how to protect your business from cyber attacks.',
  '## Introduction

Website security has never been more critical. As we navigate through 2025, cyber threats continue to evolve at an alarming pace. In this comprehensive guide, we''ll explore the top 10 security vulnerabilities that every website owner should be aware of.

## 1. SQL Injection (SQLi)

SQL injection remains one of the most dangerous vulnerabilities. Attackers can manipulate database queries to access, modify, or delete sensitive data.

**Prevention Tips:**
- Use parameterized queries
- Implement input validation
- Regular security audits

## 2. Cross-Site Scripting (XSS)

XSS attacks allow malicious scripts to be injected into trusted websites, potentially stealing user data or hijacking sessions.

**Prevention Tips:**
- Sanitize all user inputs
- Use Content Security Policy (CSP)
- Encode output data

## 3. Broken Authentication

Weak authentication mechanisms can lead to unauthorized access. This includes poor password policies and session management flaws.

## 4. Security Misconfigurations

Default configurations, incomplete setups, and exposed error messages create easy targets for attackers.

## 5. Sensitive Data Exposure

Failure to properly encrypt sensitive data in transit and at rest can lead to devastating breaches.

## Conclusion

Staying ahead of security threats requires continuous vigilance. Regular security scans, updates, and following best practices are essential for protecting your digital assets.',
  'GROWHAZ Security Team',
  ARRAY['security', 'vulnerabilities', 'cybersecurity', 'web security'],
  'Learn about the top 10 website security vulnerabilities in 2025 and how to protect your business from cyber attacks with expert tips.',
  true,
  now() - interval '2 days'
),
(
  'Complete Guide to SEO for Small Businesses in India',
  'complete-seo-guide-small-businesses-india',
  'A comprehensive SEO guide tailored for Indian small businesses. Learn local SEO, keyword research, and strategies to rank higher on Google.',
  '## Why SEO Matters for Indian Small Businesses

In today''s digital-first world, having an online presence is crucial. But simply having a website isn''t enough – you need to be found by your potential customers.

## Understanding Local SEO

For businesses serving specific geographic areas, local SEO is game-changing. Here''s how to optimize:

### Google My Business Optimization
- Complete your profile 100%
- Add accurate business hours
- Upload quality photos regularly
- Respond to reviews promptly

### Local Keywords Strategy
Target location-specific keywords like "best [service] in [city]" to capture local search intent.

## Technical SEO Essentials

### Page Speed
Indian users often browse on mobile with varying internet speeds. Optimize your site for fast loading:
- Compress images
- Use lazy loading
- Minimize JavaScript

### Mobile-First Design
Over 70% of Indian internet users browse on mobile. Ensure your site is fully responsive.

## Content Strategy

Create valuable content that answers your customers'' questions. Blog regularly about industry topics, how-to guides, and local insights.

## Measuring Success

Track your progress with:
- Google Analytics
- Google Search Console
- Keyword ranking tools

Remember, SEO is a marathon, not a sprint. Consistent effort over time yields the best results.',
  'GROWHAZ SEO Expert',
  ARRAY['SEO', 'small business', 'local SEO', 'India', 'digital marketing'],
  'Complete SEO guide for small businesses in India. Learn local SEO strategies, keyword research, and tips to rank higher on Google.',
  true,
  now() - interval '5 days'
),
(
  'How to Automate Your Business Workflows with AI',
  'automate-business-workflows-ai',
  'Discover how artificial intelligence can transform your business operations. From customer service to data analysis, learn practical AI automation strategies.',
  '## The AI Revolution in Business

Artificial Intelligence is no longer science fiction – it''s a practical tool that businesses of all sizes can leverage to increase efficiency and reduce costs.

## Customer Service Automation

### Chatbots and Virtual Assistants
Modern AI chatbots can handle up to 80% of routine customer queries, freeing your team for complex issues.

### Benefits:
- 24/7 availability
- Instant responses
- Consistent quality
- Reduced operational costs

## Data Analysis and Insights

AI can process vast amounts of data to uncover patterns humans might miss:
- Sales trend prediction
- Customer behavior analysis
- Inventory optimization
- Fraud detection

## Marketing Automation

### Email Campaigns
AI-powered email marketing can:
- Personalize content for each recipient
- Optimize send times
- A/B test automatically
- Predict campaign performance

### Social Media Management
Automate posting schedules, analyze engagement, and generate content ideas using AI tools.

## Getting Started

1. **Identify repetitive tasks** - List processes that consume time but don''t require creative thinking
2. **Start small** - Begin with one automation project
3. **Measure results** - Track time saved and efficiency gains
4. **Scale gradually** - Expand automation based on success

## Conclusion

AI automation isn''t about replacing humans – it''s about empowering them to focus on what matters most. Start your automation journey today and watch your business transform.',
  'GROWHAZ Team',
  ARRAY['automation', 'AI', 'business', 'productivity', 'technology'],
  'Learn how to automate your business workflows with AI. Practical strategies for customer service, data analysis, and marketing automation.',
  true,
  now() - interval '1 week'
);