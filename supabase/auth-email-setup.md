# Password reset emails — Supabase setup

Staff can reset their own password from **Forgot your password?** on `/login`.
The app asks Supabase to send the email; three settings in the hub project
(whzelknn…) make it work.

## 1. An email sender (required)

Supabase's built-in sender only delivers to members of the Supabase team and
only a few emails an hour. For staff to receive resets, set up your own SMTP:

**Authentication → Emails → SMTP Settings → Enable custom SMTP**

Any SMTP service works: Microsoft 365 (`smtp.office365.com`, port 587, a
mailbox such as `noreply@pasatiempo.com` with SMTP AUTH turned on), Resend,
SendGrid, Postmark. Set the sender name to "Pasatiempo".

## 2. The site address and allowed redirect

**Authentication → URL Configuration**

- Site URL: `https://pasatiempo-app.vercel.app`
- Redirect URLs: add `https://pasatiempo-app.vercel.app/**`
  (add the new domain here too when it changes)

## 3. The reset email's link (recommended)

**Authentication → Emails → Templates → Reset Password**, replace the link
with:

```html
<h2>Reset your Pasatiempo password</h2>
<p>Follow this link to set a new password. It works once and expires in an hour.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/password">Set a new password</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

This link works on any device. With Supabase's default template the link only
works in the same browser that asked for the reset, which fails when someone
requests it on a computer and opens the email on their phone.

The link lands on `app/auth/confirm/route.ts`, which signs the person in and
sends them to `/account/password` to choose a new password. Requests and
completed resets show on the super admin's **Activity** page.
