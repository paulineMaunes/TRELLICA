/**
 * Cloud Functions skeleton for Trellica
 * Deploy: cd functions && npm install && firebase deploy --only functions
 *
 * Example: callable sendMail — wire to SendGrid/Gmail API with secrets.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/** Health check */
exports.ping = functions.https.onRequest((req, res) => {
  res.json({ ok: true, service: 'trellica', time: new Date().toISOString() });
});

/**
 * Callable: sendMail({ to, subject, html })
 * TODO: add provider credentials via functions:config or Secret Manager
 */
exports.sendMail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }
  const email = context.auth.token.email || '';
  if (!/@laverdad\.edu\.ph$/i.test(email) && !/@student\.laverdad\.edu\.ph$/i.test(email)) {
    throw new functions.https.HttpsError('permission-denied', 'Domain not allowed');
  }
  // Placeholder — integrate SendGrid / Gmail API here
  console.log('sendMail requested', { to: data.to, subject: data.subject, by: email });
  return { queued: false, message: 'Configure email provider in functions/index.js' };
});
