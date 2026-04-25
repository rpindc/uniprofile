import { Amplify } from 'aws-amplify';
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_OqNHNEWZP',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '2heljmdli4f9cv2i4m0i020mfc',
    }
  }
});
export default Amplify;
