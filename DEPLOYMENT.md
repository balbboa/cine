# Deploying Cine-Tac-Toe to Vercel

This guide will help you deploy your Cine-Tac-Toe application to Vercel.

## Prerequisites

- GitHub repository with your project
- Vercel account (you can sign up at [vercel.com](https://vercel.com))
- Supabase project fully configured

## Deployment Steps

1. **Push your code to GitHub**:

```bash
git add .
git commit -m "Prepare for deployment"
git push
```

2. **Connect to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" > "Project"
   - Select your GitHub repository
   - Vercel will automatically detect it as a Next.js project

3. **Configure Environment Variables**:
   In the Vercel project setup page:
   - Add the following environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
     - `NEXT_PUBLIC_API_URL`: Leave this blank as it will be automatically set by Vercel

4. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy your application
   - You'll receive a production URL when the deployment is complete

5. **Set Up Custom Domain (Optional)**:
   - Go to Project Settings > Domains
   - Add and verify your domain

## Troubleshooting

If you encounter TypeScript errors during build:
1. Double check all your interface extensions to ensure they match their parent interfaces
2. Make sure environment variables are properly configured
3. Check for any imported types that might not be available in the build environment

## Automatic Deployments

Once set up, Vercel will automatically deploy:
- Every push to the main branch
- Pull request previews (if enabled)

## Monitoring

After deployment, you can:
- Monitor performance in the Vercel dashboard
- Set up alerts for errors
- Track usage and metrics

## Helpful Commands

**Force a rebuild on Vercel**:
```bash
vercel --prod
```

**Check build logs**:
```bash
vercel logs <deployment-url>
``` 