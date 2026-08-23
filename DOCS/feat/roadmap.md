## MVP

### Core loop

The core loop of this project is that a user stores secrets within a folder in a
specific profile and then they can edit that secret, copy it, delete it, and
perform basic CRUD operations on it, as well as dragging it into other folders
and performing a global search on all secrets across all folders in all
profiles.

#### UI bigs and fixes

- [ ] Make scrollbars always visible and make them styled nicely
- [ ] Fix secret value overflow issue with max width 20ch and then text overflow
      ellipsis, see ![image](./images/secret-value-overflow.jpg) for reference
- [ ] Make mobile friendly on screens < 800px, convert sidebar to hamburger menu
      on mobile screen that overlays when opened, make secret rows narrower by
      having the action buttons by switching flex display to flex-col display
      and having the secret action buttons be on the bottom of the secret
      textbox, Have top-level buttons wrap around well.

#### Nonfunctional requirements:

- **UI/UX**: The main focus of this app is UI/UX, so it must be very polished
  and uphold accessibility rules
- [x] **Client-side encryption at rest**: Prevents reading plaintext data,
      always encrypted at rest and then decrypted client side

#### High priority functional requirements

- User can drag folders around and rearrange them within a profile
- User can drag secrets around and rearrange them within folders and across
  folders (drag them into folders to put the secret in there, overriding
  duplicates with confirmation modal and rollback if user cancels)

#### Feature 1: checkboxes for selecting secrets

On the left side of each secret row, there should be a checkbox that the user
can check to select the secret, and then a button in the top bar should appear
that says "export" that the user can click to export the selected secrets.

1. User can select multiple secrets via checkboxes
2. User can click "export selection" button that comes up, which then makes the
   export modal appear, which has two options for how you want to export
   secrets:

- Option 1: create an .env file with the contents of the selected secrets (in
  the form of KEY=VALUE), put those contents in a text area for quick copy and
  paste and then have an optional "download .env" button at the bottom of the
  modal to download that .env file

- Option 2: Create a textarea that has the contents of the selected secrets in
  this format:

```bash
export SECRET=VALUE
```

3. For both options, add a "masking" feature where by default the secrets
   contents in the textarea is masked with asterisks, but you can unmask it by
   clicking on the eye icon.

#### Feature 2: search

User can perform global search of secrets across all folders and profiles via
typing in search bar at the top, debounced by 50ms, or using
[tanstack hotkeys](https://tanstack.com/hotkeys/latest) library to listen for
ctrl + K shortcut to focus on global search bar.

- search list will show each secret along with the folder and profile it is in
  as text pills
- In the search bar, user can scope the search down to a specific folder or
  profile via pill selection like in something like jira, and then type in text
  that matches the title of the secret via case-insensitive regex for searching.
- Using previous feature of checkboxes, user can select secrets from the search
  result list and then click an "export search" button to bring up the export
  modal.

### 2nd core loop: API spend

API spend should be developed with netlify cloud functions primarily, take care
of self-hosting later but that should just be a basic route call. Look at
[api spend implementation](./02-api-spend-feature.md) for more details.

Acceptance criteria:

- [ ] User clicks on the sidebar option "API Spend" to be taken to the api spend
      dashboard
- [ ] User can add specific keys for supported providers like openai admin key,
      openroute key, etc. to track spend, then on a refresh icon button click, a
      netlify cloud function proxy is triggered to carry out the API spend
      request for the providers registered, returns data to frontend.
- [ ] User can view the spend breakdown by provider (API) and then by specific
      provider key.

### 3rd core loop: E2E encryption sending

Look at [E2E encryption implementation](./04-e2e-encryption.md) for details on
how to implement the client-side E2E encryption completely in the browser, where
no auth or server is needed, and the user manually sends a file and auth token
to a recipient for it to decrypt.

Acceptance Criteria:

- [ ] User clicks on "export all profiles" button which opens a modal, performs
      the client side encryption, and then displays master token to send and an
      encrypted file to download.

### Push to production

1. Add authentication and payment via clerk and clerk billing with subscription
   plan with id "pro" ($10/month).
2. Paywall block api spend tab and cloud functions.
3. Add E2E encrypted file email sending with S3, Lambda, and elasticache.
4. Paywall block E2E encrypted file email sending
