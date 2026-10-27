# OASA Live feedback inbox

Feedback belongs exclusively to Firebase project `stouras-oasa-live` (OASA Live). It does not use The Lit project, database, credentials, or mail service.

The public form is `public/submit-feedback.html`. It writes comments and up to three compressed JPEG screenshots into the `feedback` collection. Optional name and email are stored only when supplied. Screenshots are resized to at most 1400 pixels and stored inline in the document, with a combined 700 KiB limit. No Storage bucket or paid plan is required. The database uses the free tier.

Review submissions in the [Firebase console](https://console.firebase.google.com/project/stouras-oasa-live/firestore). Project owners access the inbox through their Google account. Public clients can create bounded submissions only; reads, changes, and deletes are denied. No email notifications or public publication are configured.

Deploy rules using `firebase deploy --only firestore:rules --project stouras-oasa-live`. The public web SDK configuration is in `public/feedback-config.js`; access restrictions are enforced by `firestore.rules`.

The community feedback page (`feedback.html`) remains a separate public list. Private submissions do not appear there automatically.
