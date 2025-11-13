// Use dynamic requires to avoid type resolution errors if packages not yet installed in dev

export async function signInWithFacebook() {
  const auth = require('@react-native-firebase/auth').default;
  const { LoginManager, AccessToken } = require('react-native-fbsdk-next');
  // Ensure clean state to avoid reusing stale sessions
  try { LoginManager.logOut(); } catch {}

  const result = await LoginManager.logInWithPermissions([
    'public_profile',
    'email',
  ]);

  if (result.isCancelled) {
    throw new Error('Facebook login cancelled');
  }

  const tokenData = await AccessToken.getCurrentAccessToken();
  if (!tokenData?.accessToken) {
    throw new Error('No Facebook access token');
  }

  const credential = auth.FacebookAuthProvider.credential(tokenData.accessToken);
  return auth().signInWithCredential(credential);
}

export async function signOutFacebook() {
  const auth = require('@react-native-firebase/auth').default;
  const { LoginManager } = require('react-native-fbsdk-next');
  try { LoginManager.logOut(); } catch {}
  try { await auth().signOut(); } catch {}
}


