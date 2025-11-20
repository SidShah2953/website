# Blog Subdomain & Analytics Setup for siddhants.com

Complete guide for deploying the blog to `blog.siddhants.com` with Cloudflare Pages and KV-based analytics.

---

## Step 1: Create Blog Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. Click **Create application** → **Pages** → **Connect to Git**
3. Select repository: **SidShah2953/website**
4. Configure build settings:
   - **Project name**: `siddhants-blog` (or your choice)
   - **Production branch**: `Updates`
   - **Build command**: `npm run build -- --config astro.blog.config.mjs`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave empty - same repo as main site)
5. Click **Save and Deploy**

After deployment, note your Pages URL: `siddhants-blog.pages.dev`

> **Note**: The `astro.blog.config.mjs` includes a redirect from `/` to `/blog`, so visiting `blog.siddhants.com` will automatically redirect to `blog.siddhants.com/blog`.

---

## Step 2: DNS Configuration

1. Go to Cloudflare Dashboard → Select **siddhants.com** domain
2. Navigate to **DNS** → **Records**
3. Click **Add record**
4. Configure:
   - **Type**: `CNAME`
   - **Name**: `blog`
   - **Target**: `siddhants-blog.pages.dev` (from Step 1)
   - **Proxy status**: Proxied (orange cloud ☁️)
   - **TTL**: Auto
5. Click **Save**

DNS will propagate within 5-10 minutes.

---

## Step 3: Add Custom Domain to Pages Project

1. In your Pages project (`siddhants-blog`), go to **Custom domains** tab
2. Click **Set up a custom domain**
3. Enter: `blog.siddhants.com`
4. Click **Continue**
5. Cloudflare will verify the CNAME record
6. Wait 2-5 minutes for SSL certificate provisioning

Your blog will be live at: `https://blog.siddhants.com`

---

## Step 4: Environment Variables

1. In Pages project → **Settings** → **Environment variables**
2. Add these variables:

   **PUBLIC_BLOG_HOST**:
   - Variable name: `PUBLIC_BLOG_HOST`
   - Value: `blog.siddhants.com`
   - Environment: ✓ Production
   - Click **Add variable**

   **BLOG_ADMIN_TOKEN**:
   - Generate token first: Run in terminal:
     ```bash
     openssl rand -base64 32
     ```
   - Variable name: `BLOG_ADMIN_TOKEN`
   - Value: (paste generated token)
   - Environment: ✓ Production
   - Click **Add variable**
   - **Save this token** - you'll need it for `/blog/stats`

3. Click **Save and deploy**

---

## Step 5: KV Namespace Setup

### Create KV Namespace
1. Go to Cloudflare Dashboard → **Workers & Pages** → **KV**
2. Click **Create a namespace**
3. Name: `BLOG_METRICS`
4. Click **Add**

### Bind KV to Pages Project
1. Go to your Pages project (`siddhants-blog`) → **Settings** → **Functions**
2. Scroll to **KV namespace bindings**
3. Click **Add binding**
4. Configure:
   - **Variable name**: `BLOG_METRICS` (must match exactly)
   - **KV namespace**: Select `BLOG_METRICS`
5. Click **Save**
6. **Redeploy** the Pages project to activate the binding

---

## Step 6: Optional - Cloudflare Web Analytics

If you want additional Cloudflare-native analytics:

1. Go to Cloudflare Dashboard → **Analytics & Logs** → **Web Analytics**
2. Add site: `blog.siddhants.com`
3. Copy your Analytics Token
4. In `src/layouts/BlogLayout.astro`, replace the placeholder beacon script with:
   ```html
   <script defer src='https://static.cloudflareinsights.com/beacon.min.js' 
           data-cf-beacon='{"token": "YOUR_TOKEN_HERE"}'></script>
   ```
5. Commit and push to redeploy

(The KV analytics from Step 5 will work regardless)

---

## Step 7: Testing

### Test Blog Access
1. Visit: `https://blog.siddhants.com`
2. Click a post: `https://blog.siddhants.com/blog/svi-with-pyro`
3. Verify LaTeX renders (math equations display properly)
4. Check code syntax highlighting works
5. Test tag filtering: Click a tag or add `?tag=python` to URL

### Test Analytics
1. Open any blog post
2. Open DevTools (F12) → Network tab
3. Look for POST requests to `/api/blog-event`
4. Should see Status 200 for:
   - Page view event
   - Scroll events as you scroll
   - Time tracking after 30 seconds
   - Final event on page close

### Test Admin Dashboard
1. Get your saved admin token from Step 4
2. Visit: `https://blog.siddhants.com/blog/stats?token=YOUR_TOKEN_HERE`
3. Should see page view counts and engagement metrics
4. Without token should show "Unauthorized"

### Test RSS Feed
1. Visit: `https://blog.siddhants.com/blog/rss.xml`
2. Verify all blog posts are listed

### Test Redirects (requires main site deployed)
1. Visit: `https://siddhants.com/posts/svi-with-pyro`
2. Should redirect to: `https://blog.siddhants.com/blog/svi-with-pyro`
3. Check Network tab: Status 301 (permanent redirect)

---

## How It Works

### Analytics Endpoints
- **POST `/api/blog-event`** (`functions/api/blog-event.ts`)
  - Tracks: page views, time-on-page, scroll depth
  - Stores in KV: `blog:{slug}` → `{ views, totalTime, totalScroll }`
  
- **GET `/api/blog-admin-stats?token=...`** (`functions/api/blog-admin-stats.ts`)
  - Returns aggregated stats for all posts
  - Token-protected (requires `BLOG_ADMIN_TOKEN`)

### Engagement Script
`public/blog-engagement.js` (auto-loaded on all blog pages):
- Sends "view" event on page load
- Tracks scroll percentage (throttled)
- Sends time-on-page every 30 seconds
- Sends final metrics on page unload

### Data Stored in KV
For each post slug:
```json
{
  "views": 123,
  "totalTime": 45678,
  "totalScroll": 8500
}
```

Metrics calculated:
- **Average time**: `totalTime / views` seconds
- **Average scroll**: `totalScroll / views` percent

---

## Troubleshooting

### DNS not resolving
- Wait 10-15 minutes for propagation
- Check: `dig blog.siddhants.com` or `nslookup blog.siddhants.com`
- Verify CNAME: Type=CNAME, Name=blog, Target=siddhants-blog.pages.dev

### SSL certificate pending
- Usually takes 2-5 minutes
- Check: Pages → Custom domains → Status should be "Active"
- If stuck, remove and re-add custom domain

### Analytics not working
- Verify KV binding: Pages → Settings → Functions → Check `BLOG_METRICS` is bound
- Test endpoint: `curl -X POST https://blog.siddhants.com/api/blog-event -d '{"slug":"test","event":"view"}'`
- Check browser console for JavaScript errors
- Ensure `/blog-engagement.js` loads (Network tab)

### 401 on stats page
- Verify `BLOG_ADMIN_TOKEN` is set in environment variables
- Ensure token in URL matches exactly
- Redeploy after adding the variable

---

## Security Notes

- ✓ Keep `BLOG_ADMIN_TOKEN` secret - never commit to Git
- ✓ KV data only accessible through server-side Functions
- ✓ Client script doesn't expose sensitive data
- ✓ Rotate admin token every 6-12 months

---

## Next Steps

1. **Push to GitHub** - Cloudflare Pages will auto-deploy
2. **Wait for DNS** - 5-10 minutes for blog subdomain
3. **Test everything** - Use checklist in Step 7
4. **View analytics** - Visit stats dashboard after some traffic
5. **Deploy main site** - So redirects from `/posts/*` work

---

## Quick Reference

| What | URL |
|------|-----|
| Blog home | `https://blog.siddhants.com` |
| Blog post | `https://blog.siddhants.com/blog/{slug}` |
| RSS feed | `https://blog.siddhants.com/blog/rss.xml` |
| Admin stats | `https://blog.siddhants.com/blog/stats?token=TOKEN` |

**Setup complete!** 🚀 Your blog is ready at `blog.siddhants.com`

## 8. RSS & Sitemap
- RSS: `/blog/rss.xml` (`src/pages/blog/rss.xml.ts`).
- Sitemap (global): Provided by `@astrojs/sitemap` with blog host from `astro.blog.config.mjs`.
Confirm generated `sitemap-index.xml` includes blog entries using correct host.

## 9. Deployment Flow
```bash
# First build locally
PUBLIC_BLOG_HOST=blog.yourdomain.com npm run build -- --config astro.blog.config.mjs
# Deploy by pushing to branch connected to blog Pages project
```

## 10. Data Model Notes
Blog schema extends for analytics & SEO: `readingTimeMinutes` computed at runtime; optionally persist by pre-processing MDX before commit.

## 11. Hardening Suggestions (Optional)
- Rate-limit `/api/blog-event` by IP (add simple in-memory bucket in Worker or durable object).
- Add `User-Agent` filtering for bots.
- Hash session IDs to approximate unique readers.

## 12. Cleanup
After confirming deployment, you can delete this file (`del_aft_use_BLOG_SETUP.md`).

## 13. Troubleshooting
| Symptom | Possible Cause | Fix |
|--------|----------------|-----|
| 401 on stats | Missing/incorrect token | Set `BLOG_ADMIN_TOKEN` env var & pass query param |
| No KV data | KV not bound | Bind namespace in Functions settings |
| Blog pages show main site canonical | Missing `PUBLIC_BLOG_HOST` env | Set variable & redeploy |
| Engagement script 404 | Function path mismatch | Ensure file path is `functions/api/blog-event.ts` |

## 14. Next Enhancements
- Add tag filtering (`/blog?tag=astro`).
- Show live view counts on listing via client fetch.
- Add reading progress indicator.
- Implement incremental build with content metrics.

---
Generated on: 2025-11-20
