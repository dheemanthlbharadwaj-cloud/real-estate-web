// Public Firebase web config (these values are not secrets; access is enforced by
// Firebase Auth + firestore.rules). Set them as Vercel environment variables.
module.exports = (req, res) => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId) return res.status(500).json({ error: 'Firebase is not configured on the server' });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(config);
};
