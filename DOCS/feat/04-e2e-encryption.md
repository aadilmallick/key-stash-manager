# E2E encryption planned implementation

## First principles

### **Step 1: Client-Side Key Generation (The Correct Way)**

When a user decides to share a `.env` file, the browser frontend generates a
highly secure symmetric key and an initialization vector (IV) entirely in memory
using the native Web Crypto API.

```javascript
// Run completely client-side in the browser
const encryptionKey = await window.crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"],
);

const iv = window.crypto.getRandomValues(new Uint8Array(12));
```

### **Step 2: Split the Secret (The URL Fragment Trick)**

Instead of relying on the server to hold the key, utilize the **URL hash
fragment (** `#` **)**. Data following a `#` in a URL is **never** sent to the
server by modern web browsers. It stays completely inside the recipient's
browser.

- **The Secret Key**: `AES_KEY_HEX_STRING`
- **The Server Token**: `SERVER_SHORT_ID` (stored in Redis)

### **Step 3: Executing the Two Paths Securely**

**Path A: Manual Download**

1. The sender encrypts the file locally with their generated `AES_KEY`.
2. The sender passes the encrypted file blob and the plaintext link containing
   the `#AES_KEY` directly to the recipient via their own trusted channels
   (e.g., Signal, Slack).
3. The server is involved exactly **0%** of the time. This is bulletproof E2EE.

**Path B: Notify/Server-Hosted Path (With Expiry & One-Time Features)**

If the user wants your server to orchestrate the transfer so you can notify
people via email or something, you combine the server's tracking capabilities
with client-side keys:

1. **Upload**: The client encrypts the `.env` file locally. They upload _only_
   the raw ciphertext to your server.
2. **Server Storage**: Your server pushes the ciphertext to an S3 bucket and
   saves an entry in Redis mapped to a random `SERVER_SHORT_ID`. Here, you
   enforce your `encryptionMode`:
   - `onetime`: Delete the ciphertext from S3/Redis immediately after the first
     download request.
   - `timebased`: Set a strict Redis TTL (Time-To-Live) on the ID. When the
     timer expires, Redis drops the reference, and a worker deletes the S3 file.
3. **The Link**: The server returns the `SERVER_SHORT_ID` to the client. The
   client's frontend app constructs the full link:
   `/env/share/SERVER_SHORT_ID#AES_KEY`.
4. **Delivery**: The client enters the recipient's email. The frontend sends the
   email address and `SERVER_SHORT_ID` to the server to send the notification
   link. **Crucial:** The server only emails the link up to the
   `SERVER_SHORT_ID`. The sender must give the `#AES_KEY` password to the
   recipient through a separate secure message, or you can include it if the
   user accepts that email providers will see it.
5. **Decryption**: The recipient clicks the link and then verifies their email
   with an OTP code sent to the email. Their browser fetches the raw encrypted
   payload from your server using `SERVER_SHORT_ID`. Once the browser downloads
   the ciphertext, the JavaScript running in their tab grabs the `AES_KEY` from
   the URL hash fragment and decrypts the file completely locally.

## Implementation

Here is the complete implementation for your true E2EE architecture. It includes
the frontend browser code using the native Web Crypto API and the backend Redis
database schema optimized for TTL-based and one-time expiration.

---

### **🎨 1. Browser Client Code (Web Crypto API)**

This handles file encryption, file decryption, and generating the safe URL hash
string. Paste this into your local-first JavaScript app.

```
// cryptoService.js

/**
 * Encrypts a string payload (like an env file or JSON profile) client-side.
 * @param {string} plaintextText - The raw secret content.
 * @returns {Promise<{ciphertextHex: string, ivHex: string, keyHex: string}>}
 */
async function encryptPayload(plaintextText) {
  // 1. Generate a secure 256-bit AES-GCM symmetric key in memory
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // Extractable so we can turn it into a hex string for the URL hash
    ["encrypt", "decrypt"]
  );

  // 2. Generate a fresh 12-byte initialization vector (nonce)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encode text to bytes and encrypt
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plaintextText);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedText
  );

  // 4. Export the raw key to share via the URL anchor tag
  const exportedRawKey = await window.crypto.subtle.exportKey("raw", key);

  // 5. Convert everything to Hex strings for easy network/URL transport
  return {
    ciphertextHex: bufToHex(ciphertextBuffer),
    ivHex: bufToHex(iv),
    keyHex: bufToHex(exportedRawKey)
  };
}

/**
 * Decrypts a ciphertext blob locally in the user's browser.
 * @param {string} ciphertextHex - Encrypted data string from server.
 * @param {string} ivHex - The initialization vector from server.
 * @param {string} keyHex - The secret key extracted from window.location.hash.
 * @returns {Promise<string>} Plaintext secret content.
 */
async function decryptPayload(ciphertextHex, ivHex, keyHex) {
  const ciphertext = hexToBuf(ciphertextHex);
  const iv = hexToBuf(ivHex);
  const rawKey = hexToBuf(keyHex);

  // Import the hex key back into a CryptoKey object
  const key = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt the payload
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// --- Helper Functions to handle ArrayBuffers as Hex Strings ---
function bufToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hexString) {
  return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16))).buffer;
}
```

#### **How to construct and read your Frontend Sharing Links:**

```
// SENDER SIDE (After uploading encrypted data to server and receiving a fileId)
const shareableUrl = `https://keystashmanager.netlify.app{fileId}#${keyHex}`;

// RECIPIENT SIDE (On page load of /env/decrypt/:fileId)
const fileId = params.fileId; // URL parameter
const keyHex = window.location.hash.substring(1); // Grabs string after the # safely
```

---

### **🗄️ 2. Redis TTL Database Schema**

Your server acts strictly as an **oblivious tracking mailbox**. Instead of
complex hashes or server keys, use **Redis Hashes** combined with predictable
namespace structures and strict **Time-To-Live (TTL)** parameters.

Here are the key namespace patterns:

1. `secret:{fileId}` ➔ Main file storage metadata hash.
2. `lock:{fileId}` ➔ Concurrency lock for `onetime` actions (prevents
   double-read race conditions).

---

#### **📋 Case 1:** `encryptionMode: 'timebased'`

Use a standard Redis hash payload. Set a native Redis expiration on the key
using `EXPIRE`. When the timer hits 0, Redis permanently drops the record
automatically.

- **Command to Save**:

  ```
  HSET secret:abcd123xyz ciphertext "0f7a2b..." iv "9a2e4c..." mode "timebased" s3Url "https://s3..."
  EXPIRE secret:abcd123xyz 3600  # Expires in 1 hour (3600 seconds)
  ```

#### **📋 Case 2:** `encryptionMode: 'onetime'`

The record behaves identically to `timebased` but has a baseline safety TTL
(e.g., 24 hours max) in case nobody ever claims it. The primary deletion
mechanism happens explicitly on the _very first read request_.

- **Command to Save**:

  ```
  HSET secret:efgh456abc ciphertext "7c2b1a..." iv "1a5f8e..." mode "onetime"
  EXPIRE secret:efgh456abc 86400  # 24 hours safety ceiling
  ```

---

### **🏎️ 3. Handling the "One-Time" Read on Server (Node.js)**

To prevent an attacker from wiretapping a `onetime` share link and reading it
concurrently at the exact same moment as your recipient, use an atomic
transaction or a distributed lock mechanism.

Here is the clean Node.js endpoint logic using `ioredis`:

```
// server.js - Decryption Request Router Example
app.get('/api/secret/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const key = `secret:${fileId}`;
  const lockKey = `lock:${fileId}`;

  // 1. Fetch metadata payload
  const secretData = await redis.hgetall(key);

  if (!secretData || Object.keys(secretData).length === 0) {
    return res.status(404).json({ error: "Secret expired, already read, or non-existent." });
  }

  // 2. Evaluate Expiration Rules
  if (secretData.mode === 'onetime') {
    // Acquire a short atomic lock to eliminate double-fetch race conditions
    const acquiredLock = await redis.set(lockKey, "locked", "NX", "EX", 5);
    if (!acquiredLock) {
      return res.status(410).json({ error: "This secret is currently being read or deleted." });
    }

    // Atomic wipe from memory right before serving it
    await redis.del(key);
    await redis.del(lockKey);

    // CRITICAL: Schedule your S3 background deletion task here if using S3 hosting!
    if (secretData.s3Url) {
       await deleteFromS3Bucket(secretData.s3Url);
    }
  }

  // 3. Respond with encrypted bundle. 
  // Notice: Server has NO access to the decryption key because it is trapped in the user's URL hash!
  return res.json({
    ciphertext: secretData.ciphertext,
    iv: secretData.iv
  });
});
```

---

### **🔒 4. Production Checklist for Keystash Manager**

- **Content Security Policy (CSP)**: Set a strict CSP header on Netlify. Block
  `script-src 'unsafe-inline'` completely. If malicious code can inject scripts
  into your frontend tab, it can parse `window.location.hash` and steal keys
  before encryption/decryption occurs.
- **No Server-Side Error Logs containing URLs**: Ensure your web server does not
  log full request URLs if users accidentally paste the hash link into an API
  call directly instead of loading the browser UI.

---

Would you like to build out the **multipart S3 file streaming upload script**
next to support large `.env` profiles, or look into the **HTML/JS integration UI
layout** for downloading the file seamlessly inside the browser?

## Server implementation

The most secure, high-performance, and cost-effective approach for Keystash
Manager is **AWS Lambda paired with Pre-signed URLs**.

---

The choice between a **long-running Node/Express server (e.g., Deno Deploy / VPS
/ Render)** and **AWS Lambda** comes down to how your app authenticates,
transfers data, and interacts with S3.

Because you are building a **True E2EE** architecture, your server never needs
to see or process the files; it only acts as an oblivious tracking mailbox. This
changes the tradeoffs significantly.

The most secure, high-performance, and cost-effective approach for Keystash
Manager is **AWS Lambda paired with Pre-signed URLs**.

---

## **🏛️ The Structural Tradeoffs**

| Criteria                  | Node/Express (Deno Deploy / Vercel + Blob Store)                                                                                              | AWS Lambda + S3 (Serverless Architectures)                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Data Flow Security**    | **Lower.** File bytes must travel _through_ your server to the blob store. If the server is compromised, files can be intercepted in transit. | **Highest.** The server _never_ touches file data. Lambda generates a Pre-signed URL, and the client uploads directly to S3. |
| **VPC & Network Control** | Requires complex setups or paid enterprise tiers to securely bind Deno Deploy to a private storage network.                                   | **Native.** Lambda can run inside a Private VPC, keeping your S3 bucket isolated from the public internet entirely.          |
| **Performance (Latency)** | **Slower for large files.** Client ➔ Server ➔ Storage (2 network hops for every file upload/download).                                        | **Fastest.** Client ➔ S3 directly (1 network hop). No server RAM or bandwidth throttling.                                    |
| **Cost Scale**            | Fixed pricing or high bandwidth fees if you proxy massive `.env` or JSON zip profiles through a server instance.                              | **Fraction of a cent.** You only pay for milliseconds of Lambda runtime to generate text strings (URLs).                     |

---

## **🛡️ Why AWS Lambda + S3 Wins for Security and Performance**

In a standard Node/Express setup, your server proxies the upload. If an attacker
gains access to your server, they can alter the runtime code to dump plaintext
or ciphertext streams.

By using **AWS Lambda + S3 Pre-signed URLs**, your security posture drastically
improves because you eliminate the middleman entirely:

```
[ Sender Browser ] ────── 1. Request Upload URL ─────> [ AWS Lambda ] (In Private VPC)
[ Sender Browser ] <──── 2. Returns Pre-signed URL ─── [ AWS Lambda ]
[ Sender Browser ] ────── 3. PUT Encrypted File ──────> [ Private S3 Bucket ]
```

## **How it works:**

1. **The VPC Shield**: Your S3 bucket has a bucket policy that denies all public
   traffic except via your **VPC Endpoint**. Your AWS Lambda functions live
   inside this Private VPC. [1, 2, 3]
2. **The Handshake**: When a user wants to upload an encrypted profile, their
   browser pings your Lambda function. Lambda verifies the user's API rate
   limits and asks S3 for a **Pre-signed PUT URL** (valid for 5 minutes). [4]
3. **Direct-to-S3 Upload**: Lambda hands this temporary URL back to the client.
   The browser uploads the encrypted payload _directly_ to S3. The Lambda
   execution ends immediately. [5, 6]
4. **The "One-Time" Read**: When a recipient claims a `onetime` download, Lambda
   generates a **Pre-signed GET URL**, deletes the object metadata from Redis
   atomically, and passes the GET URL to the browser. The browser downloads the
   encrypted blob, and AWS automatically handles the high-bandwidth transfer.
   [7]

---

## **🛠️ Best Production Combination**

To get the absolute best of both worlds (simplicity of JavaScript deployment +
bulletproof AWS security), use **Serverless Framework** or **SST (Serverless
Stack)** to deploy. [8, 9]

## **1. Lambda Code for Client Upload (Node.js)**

```
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  const { fileId, encryptionMode } = JSON.parse(event.body);

  // 1. Generate an S3 Pre-signed URL for a direct client upload
  const command = new PutObjectCommand({
    Bucket: process.env.PRIVATE_BUCKET_NAME,
    Key: `secrets/${fileId}.enc`,
    ContentType: "application/octet-stream"
  });

  // URL expires in 5 minutes, giving frontend just enough time to upload
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  // 2. Save metadata state to your separate Redis instance
  // (Include your TTL logic from the previous step here)
  await saveToRedis(fileId, encryptionMode);

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "https://netlify.app" },
    body: JSON.stringify({ uploadUrl })
  };
};
```

## **2. S3 Bucket Lifecycle Rules (Your Expiration Insurance)**

Do not rely _only_ on Redis to delete files from S3. If your server crashes
mid-request, orphan files will sit in S3 forever.

- **Fix**: Configure an **S3 Lifecycle Policy** on your bucket that
  automatically deletes any object inside the `secrets/` prefix after **24
  hours**. This ensures that even if a `timebased` or `onetime` share is
  forgotten, AWS wipes the storage media automatically. [10, 11]

---

To help finalize your infrastructure architecture, let me know:

- Do you already have an **existing Redis provider** selected (like Upstash or
  ElastiCache) that we need to connect to the Lambda?
- Would you like the corresponding **frontend JavaScript snippet** showing how
  to upload the encrypted binary array directly to that AWS pre-signed URL?

[1]
[https://www.examtopics.com](https://www.examtopics.com/discussions/amazon/view/11279-exam-aws-certified-machine-learning-specialty-topic-1/)

[2]
[https://quizlet.com](https://quizlet.com/833508938/design-secure-architectures-section-exam-flash-cards/)

[3]
[https://aws.plainenglish.io](https://aws.plainenglish.io/deploying-aws-lambda-in-a-vpc-best-practices-and-rds-proxy-integration-a574faf67d65)

[4]
[https://medium.com](https://medium.com/@pmmswe/serverless-file-uploads-with-aws-s3-pre-signed-urls-1f9d830157ea)

[5]
[https://devcenter.heroku.com](https://devcenter.heroku.com/articles/s3-upload-node)

[6]
[https://www.cloudthat.com](https://www.cloudthat.com/resources/blog/what-is-aws-lambda-a-beginners-guide-to-serverless-in-2025)

[7]
[https://bilue.com.au](https://bilue.com.au/article/aws-serverless-an-in-depth-guide-for-2022)

[8]
[https://medium.com](https://medium.com/captech-corner/serverless-framework-vs-cdk-which-one-should-i-use-49b10ddbea0b)

[9]
[https://dev.to](https://dev.to/aws-builders/using-serverless-framework-and-cdk-together-12he)

[10]
[https://quizlet.com](https://quizlet.com/420113457/aws-solutions-architect-qas-flash-cards/)

[11]
[https://cloudiofy.com](https://cloudiofy.com/aws-certified-solution-architect-associate-exam-practice-questions/)
