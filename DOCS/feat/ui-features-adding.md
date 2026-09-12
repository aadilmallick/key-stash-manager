# UI overview

Libraries to consider, but you have full jurisdiction over what to install:

- React DnD for drag and drop
- Tanstack hotkeys for easy keyboard shortcuts integration
- Shadcn combobox for multi-select, install with
  `npx shadcn@latest add combobox`

#### UI bigs and fixes

- [ ] Make scrollbars always visible and make them styled nicely
- [ ] Fix secret value overflow issue with max width 20ch and then text overflow
      ellipsis, see ![image](./images/secret-value-overflow.jpg) for reference

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

> Tip from Coderabbit: Specify shell-safe export serialization. Export values
> containing spaces, quotes, newlines, #, or backslashes may not round-trip and
> may be interpreted by a shell when sourced. Require key-name validation,
> parser-compatible quoting and escaping, and round-trip tests for both formats.

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

Basically filtering criteria will be the following:

- **key name**: case-insensitive text regex matching of the key name, ignore
  delimiters like hyphens, spaces, underscores, to make it easy for the user,
  create class SecretTextFilter with OOP as abstraction over this
- **profile**: by default, search across all profiles, can granularly choose
  profiles with multiselect
- **folder**: by default, search across all folders, but via select tag,
  granularly choose folders with multiselect

Basically a secret is considered unique by its combination of key name, profile,
and folder

Create a SecretFilter OOP class using the builder strategy to handle the pure
business logic behind the filtering dynamically, and create unit tests for that
to make sure your logic is correct

Each earch result card (individual key matching the criteria) should have this
information populated:

- name of the key (text)
- Masked value disabled textinput, clamped to 10ch and ellipsis overflow (and
  unmask icon on the right)
- profile (text pill)
- folder (text pill)

The default keyboard shortcut should be CTRL + K or CMD + K

See DOCS/feat/search-and-export-mockup.png for reference

#### Feature 3: drag and drop

Add react DnD for this:

- User can drag folders around and rearrange them within a profile
- User can drag secrets around and rearrange them within folders and across
  folders (drag them into folders to put the secret in there, overriding
  duplicates with confirmation modal and rollback if user cancels)
