# Connecting the receiving log (once)

The Merchandise Program reads the receiving log (the Google Sheet "Receiving File '23-'26") so Orders & receiving can
show what has arrived. It only ever **reads** the sheet: it asks Google for read-only access and never changes a cell.
Nothing is added to the sheet.

Until these steps are done, Orders & receiving says "The receiving log isn't connected yet", and orders can still be
marked arrived by hand with **Invoice in**.

## 1. Make the app its own Google account (about 10 minutes, the owner)

1. Go to <https://console.cloud.google.com/> and sign in with a Google account the club controls.
2. Create a project, for example **Pasatiempo Merch**.
3. In **APIs & Services → Library**, find **Google Sheets API** and press **Enable**.
4. In **APIs & Services → Credentials**, choose **Create credentials → Service account**. Name it, for example,
   **merch-receiving-log**. It needs no roles: skip the optional steps.
5. Open the new service account, go to **Keys → Add key → Create new key → JSON**. A file downloads. Keep it private:
   it is the account's password.
6. Note the service account's email: it looks like `merch-receiving-log@pasatiempo-merch.iam.gserviceaccount.com`.

## 2. Give the key to the app

1. In Vercel, open the **pasatiempo-app** project → **Settings → Environment Variables**.
2. Add **`GOOGLE_SERVICE_ACCOUNT_JSON`** for Production (and Preview if wanted). The value is the whole contents of the
   downloaded JSON file.
3. Redeploy, or wait for the next deploy, so the app picks it up. Then delete the downloaded file from your computer.

(Optional: `MERCH_LOG_SHEET_ID` if the log ever moves to a different spreadsheet; it defaults to the current one.)

## 3. Share the log with the app, as Viewer (the shop's account)

1. Sign in to Google as **pasatiemposhop@gmail.com** (the sheet's owner) and open the receiving log.
2. **Share** → paste the service account's email from step 1.6 → choose **Viewer** → untick "Notify people" → **Share**.

That's all. The next time someone opens Orders & receiving (or the next morning), the log is read. Rows from that day
on appear under **Match from the receiving log**; earlier rows are left out.

## If something goes wrong

Orders & receiving shows one line saying what to fix:

- "The receiving log isn't connected yet." — step 2 hasn't taken effect (check the variable and redeploy).
- "The app can't open the receiving log. Share it with … as Viewer." — step 3 (share with exactly that email).
- "Google didn't answer; showing the log as of …" — Google was unavailable; it is read again shortly.

Rows the program can't read (a missing price, or a date far behind the rows above it, like a mistyped year) are
listed on Orders & receiving under "rows couldn't be read" so they can be fixed in the sheet.

To disconnect, remove the service account from the sheet's sharing, or delete its key in the Google Cloud console.
