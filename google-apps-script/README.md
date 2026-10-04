# Connect the RSVP spreadsheet

1. Open spreadsheet `1qKxOGBSZ2VztimSkuKSx8Q0GWwkLx2EJrE0Qvvu5hvM` and choose **Extensions → Apps Script**.
2. Replace the editor's `Code.gs` contents with this folder's `Code.gs` and save.
3. Select **setup** in the function dropdown and click **Run**. Authorize spreadsheet access with the spreadsheet owner's account. This prepares the `RSVP` tab without removing existing responses.
4. Columns A–F must be date, name, attendance, alcohol, accommodation, comment, in that order. Column G is reserved for response IDs to prevent duplicates on retries; leave it available.
5. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then deploy.
6. Copy the web app URL ending in `/exec` into `RSVP_ENDPOINT` in `assets/rsvp.js`, or send it to the developer to finish configuration. Keep the spreadsheet private.
7. Test from the website: submit a response, verify the success message and the row in `RSVP`. Verify missing fields are rejected. The form retains entries if saving cannot be confirmed.

The deployment URL is configured in `assets/rsvp.js`. A complete live submission from the website still needs verification.
After changing Apps Script code, use **Deploy → Manage deployments → Edit → New version → Deploy**.

Google documentation:
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/content
