/**
 * Google OAuth Service
 * Handles Google authentication for Expo/React Native + Web
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// ============================================================================
// Error Types
// ============================================================================

export enum GoogleAuthErrorCode {
  CONFIG_ERROR = 'CONFIG_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  AUTH_FAILED = 'AUTH_FAILED',
  REVOKE_FAILED = 'REVOKE_FAILED',
  REVOKE_ERROR = 'REVOKE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PLATFORM_ERROR = 'PLATFORM_ERROR',
}

export class GoogleAuthError extends Error {
  public readonly code: GoogleAuthErrorCode;
  public readonly originalError?: unknown;
  public readonly timestamp: number;

  constructor(message: string, code: GoogleAuthErrorCode, originalError?: unknown) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = Date.now();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GoogleAuthError);
    }
  }
}

// ============================================================================
// Types
// ============================================================================

export interface GoogleUserProfile {
  name?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  picture?: string;
  locale?: string;
  emailVerified?: boolean;
}

export interface GoogleAuthResult {
  idToken: string;
  user?: GoogleUserProfile;
}

// ============================================================================
// Discovery document
// ============================================================================

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// ============================================================================
// Config
// ============================================================================

function getClientId(): string {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '';
  return clientId;
}

function createRedirectUri(): string {
  if (Platform.OS === 'web') {
    const origin =
      typeof window !== 'undefined' && window?.location?.origin
        ? window.location.origin
        : 'http://localhost:8081';
    return origin;
  }
  return AuthSession.makeRedirectUri();
}

// ============================================================================
// Helpers
// ============================================================================

function isValidIdToken(token: string | undefined): token is string {
  if (typeof token !== 'string' || token.length === 0) return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function decodeBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 1) throw new Error('Invalid base64 string');
  if (pad) base64 += '='.repeat(4 - pad);
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    if (!isValidIdToken(token)) return null;
    const base64Url = token.split('.')[1];
    const jsonPayload = decodeBase64Url(base64Url);
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// ============================================================================
// Main sign-in function
// ============================================================================

export async function signInWithGoogle(): Promise<GoogleAuthResult | null> {
  const clientId = getClientId();

  if (!clientId || clientId.trim() === '') {
    throw new GoogleAuthError(
      'Google OAuth Client ID is not configured. Set EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID.',
      GoogleAuthErrorCode.CONFIG_ERROR
    );
  }

  const redirectUri = createRedirectUri();

  console.log('[GoogleAuth] Starting OAuth flow');
  console.log('[GoogleAuth] Platform:', Platform.OS);
  console.log('[GoogleAuth] Redirect URI:', redirectUri);
  console.log('[GoogleAuth] Client ID prefix:', clientId.substring(0, 20) + '...');

  try {
    // FIX: On web, use ResponseType.Token (implicit flow) with nonce.
    // This returns id_token directly in the URL fragment — no server exchange needed.
    // ResponseType.Code requires a backend token exchange to get id_token,
    // which expo-auth-session does NOT do automatically on web.
    const responseType =
      Platform.OS === 'web'
        ? AuthSession.ResponseType.Token
        : AuthSession.ResponseType.IdToken;

    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      responseType,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false, // Must be false for implicit/token flow
      extraParams:
        Platform.OS === 'web'
          ? {
              // nonce required by Google for openid scope on web implicit flow
              nonce: Math.random().toString(36).substring(2),
            }
          : {},
    });

    const result = await request.promptAsync(discovery);

    console.log('[GoogleAuth] Result type:', result.type);

    if (result.type === 'dismiss' || result.type === 'cancel') {
      console.log('[GoogleAuth] User cancelled or dismissed');
      return null;
    }

    if (result.type !== 'success') {
      console.error('[GoogleAuth] Auth failed:', result);
      throw new GoogleAuthError('Authentication failed', GoogleAuthErrorCode.AUTH_FAILED, result);
    }

    const params = result.params as Record<string, string | undefined>;

    // On web (token flow): id_token comes in params directly
    // On native (idToken flow): id_token also comes in params
    const rawToken: string | undefined =
      params['id_token'] ||
      (result as any)?.authentication?.idToken;

    console.log('[GoogleAuth] Token received:', rawToken ? `${rawToken.length} chars` : 'NONE');
    console.log('[GoogleAuth] Param keys:', Object.keys(params));

    if (!isValidIdToken(rawToken)) {
      console.error('[GoogleAuth] Invalid or missing token', {
        tokenLength: rawToken?.length ?? 0,
        paramKeys: Object.keys(params),
      });
      throw new GoogleAuthError(
        'Invalid ID token received from Google',
        GoogleAuthErrorCode.INVALID_TOKEN
      );
    }

    console.log('[GoogleAuth] Login successful');
    return { idToken: rawToken };
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    console.error('[GoogleAuth] Unexpected error:', error);
    throw new GoogleAuthError(
      'An unexpected error occurred during Google authentication',
      GoogleAuthErrorCode.UNKNOWN_ERROR,
      error
    );
  }
}

// ============================================================================
// Sign out
// ============================================================================

export async function signOutFromGoogle(idToken?: string): Promise<boolean> {
  if (!idToken) return true;
  try {
    await revokeToken(idToken);
    return true;
  } catch (error) {
    console.error('[GoogleAuth] Error during token revocation', error);
    return false;
  }
}

export async function revokeToken(token: string): Promise<void> {
  if (!token || token.trim() === '') {
    throw new GoogleAuthError('Token is required', GoogleAuthErrorCode.VALIDATION_ERROR);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(discovery.revocationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${encodeURIComponent(token)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok && response.status !== 400) {
      throw new GoogleAuthError(
        `Token revocation failed with status ${response.status}`,
        GoogleAuthErrorCode.REVOKE_FAILED
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof GoogleAuthError) throw error;
    if ((error as any).name === 'AbortError') {
      throw new GoogleAuthError('Token revocation timed out', GoogleAuthErrorCode.TIMEOUT_ERROR, error);
    }
    throw new GoogleAuthError('Failed to revoke token', GoogleAuthErrorCode.REVOKE_ERROR, error);
  }
}

// ============================================================================
// Utilities
// ============================================================================

export function decodeIdToken(token: string): GoogleUserProfile | null {
  try {
    const payload = decodeJWTPayload(token);
    if (!payload) return null;
    return {
      name: payload.name as string | undefined,
      givenName: payload.given_name as string | undefined,
      familyName: payload.family_name as string | undefined,
      email: payload.email as string | undefined,
      picture: (payload.picture as string | undefined) || (payload.pic as string | undefined),
      locale: payload.locale as string | undefined,
      emailVerified: payload.email_verified as boolean | undefined,
    };
  } catch {
    return null;
  }
}

export function isGoogleOAuthSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web';
}

export function isConfigured(): boolean {
  const clientId = getClientId();
  return !!(clientId && clientId.trim() !== '');
}
