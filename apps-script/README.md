# MyBTO backend: Google Sheet + Apps Script

Free. No server, no Firebase, no secrets. The sheet stores rankings and shortlists. The Apps Script web app receives them from the website and also answers the Analytics page.

Files in this folder:
- `Code.gs`: the web app (`doPost`, `doGet`), `setup()`, `importSample()`.
- `Analytics.js`: row layout, checks and the analytics maths. **Paste it into Apps Script as a file called `Analytics.gs`** (the editor only knows `.gs` files when you paste by hand; `.js` is only for `clasp`, and the tests run this same file in Node).
- `appsscript.json`: the manifest (time zone Asia/Singapore, web app runs as you, open to everyone, the two permissions it needs).

## Steps (about 10 minutes)

1. Sign in to the new Google account. Go to https://sheets.new and create a blank sheet. Name it "MyBTO data".
2. In the sheet: **Extensions > Apps Script**. A project opens (it belongs to this sheet).
3. Replace the contents of `Code.gs` with the contents of `apps-script/Code.gs`.
4. Click **+** next to Files > **Script**, name it `Analytics` (it becomes `Analytics.gs`), and paste the contents of `apps-script/Analytics.js`.
5. Click the gear (**Project settings**) on the left and tick **Show "appsscript.json" manifest file in editor**. Go back to the editor, open `appsscript.json`, and replace its contents with `apps-script/appsscript.json`.
6. Click **Save project**. Choose `setup` in the function drop-down at the top and press **Run**. Google asks you to authorise: **Review permissions**, pick your account, **Advanced > Go to ... (unsafe)** (it is your own script), **Allow**. Check the sheet: it now has the tabs Rankings, Shortlists, Sample and Settings.
7. Choose `importSample` and press **Run**. This needs the website to be live at https://mybto.web.app, because it downloads the 420 sample users from there. The Sample tab fills up. (If it says it could not download, deploy the website first and run it again.)
8. **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Press **Deploy**.
9. Copy the **Web app URL** (it ends in `/exec`) and give it to Claude (it goes into `public/js/config.js` as `SHEETS_URL`). The address is not a secret: the website sends it to every visitor anyway. The limits that protect the sheet are in `doPost` and `Analytics.js` (size cap 200 KB, fixed list of allowed fields and projects, rate limits, row caps, one write at a time).

To test: open the `/exec` URL with `?action=analytics&project=berlayar-rise-7` added. You should see JSON starting `{"ok":true`.

## The sheet

| Tab | What it holds |
|---|---|
| Rankings | One row per ranking press: time, anonymous user id, project, housing type, blocks, storey range, floor preference, one weight column per factor, sun/design/block/facility weights as `name: value` lists, consent, units ranked, top 50 and the full ranking (spread over up to 4 columns, because a cell holds 50,000 characters at most). |
| Shortlists | One row per user and project (updated in place): `unit_ids` in the order chosen. |
| Sample | The 420 made-up users from `importSample()`. Same columns as Rankings. |
| Settings | `B1` = `INCLUDE_SAMPLE`. TRUE mixes the Sample tab into Analytics. Set it to FALSE once enough real rankings exist. |

Analytics uses each user's **latest** ranking per project. Results are cached for 5 minutes, so a new ranking shows up on the Analytics page after up to 5 minutes. Unit ids are never sent to the Analytics page.

## Updating the script

Whenever `Code.gs` or `Analytics.js` changes in the repo:

1. In the Apps Script editor paste the new `apps-script/Code.gs` over `Code.gs` and the new `apps-script/Analytics.js` over `Analytics.gs`. Both files must be updated together. **Save project.**
2. **Deploy > Manage deployments > pencil (edit) > Version: New version > Deploy.** The same `/exec` URL keeps working, so nothing on the website changes. Saving alone does not update the live web app.

## Limits that protect the sheet

- Only the 7 known project keys (`PROJECT_KEYS` in `Analytics.js`) are accepted, for writes and for Analytics. Add a key there when a new project launches.
- Per user: one ranking per 5 seconds, one shortlist write per 2 seconds. Across everyone: 2,000 rankings and 5,000 shortlist writes per clock hour. Over a limit the script answers `{"ok":false,"error":"slow down"}`; the website ignores the answer, so visitors notice nothing, and writes resume by themselves in the next window. Change `USER_GAP_SECONDS` and `HOURLY_CEILING` at the top of `Code.gs` if real traffic needs more.
- Request bodies over 200 KB (counted in bytes) are refused. The row caps (200,000 rankings, 100,000 shortlists) are only a last-resort safety net. If one is reached, archive old rows and writes resume.
- Analytics reads only the columns it needs, only for the requested project, and returns `{"ok":false,"error":"not enough data yet"}` until a project has at least 5 users (real plus sample).

## Excel and sharing

- Excel: in the sheet, **File > Download > Microsoft Excel (.xlsx)**.
- Share with the team: the **Share** button in the sheet, add their Google accounts as Viewer (or Editor). Sharing the sheet does not give access to the web app settings; for that, share the Apps Script project from its own **Share** button too. Do not make the sheet public: it holds every user's rankings.
