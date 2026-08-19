User must be authenticated in order to access features like api spend and E2E
encryption email sending.

- Clerk and clerk billing, auth via email and verification code.
- Paywall on api spend feature and E2E encryption email sending feature.
- For implementing E2E encryption email sending, factor in emails of users
  somehow for encrypting the data ot make sure only the person logged in with an
  email that is one of the recipients can decrypt the file, and also require
  email login to decrypt the file when a recipient goes to
  `/env/decrypt/:fileid`:
  1. Once authenticated, server sends file down, recipient uses decryption key
     they were emailed or server sends it down, recipient confirms that they
     want to decrypt the secrets and now the recipient has the keys, overiddes
     all profiles all secrets
