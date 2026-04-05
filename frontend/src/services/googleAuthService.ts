/**
 * Google OAuth Service
 * Handles Google authentication flow for Expo/React Native
 * 
 * Features:
 * - OAuth 2.0 authentication with Google
 * - Token management (revoke)
 * - Type-safe error handling with error codes
 * - Configurable logging with debug mode
 * - Request timeout handling
 * - Platform compatibility checks
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Configure web browser for auth session
WebBrowser.maybeCompleteAuthSession();

// ============================================================================
// Constants
// ============================================================================

/** Default request timeout in milliseconds */
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

/** OAuth response type */
const AUTH_RESPONSE_TYPE = AuthSession.ResponseType.IdToken;

/** Default scopes for Google OAuth */
const DEFAULT_SCOPES = ['openid', 'profile', 'email'] as const;

// ============================================================================
// Error Codes
// ============================================================================

export enum GoogleAuthErrorCode {
  /** OAuth Client ID is not configured */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Invalid ID token format received */
  INVALID_TOKEN = 'INVALID_TOKEN',
  /** Authentication flow failed */
  AUTH_FAILED = 'AUTH_FAILED',
  /** Token revocation failed */
  REVOKE_FAILED = 'REVOKE_FAILED',
  /** Token revocation request error */
  REVOKE_ERROR = 'REVOKE_ERROR',
  /** Network request timeout */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  /** Network error occurred */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Unknown/unexpected error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  /** Invalid input parameter */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Platform not supported */
  PLATFORM_ERROR = 'PLATFORM_ERROR',
}

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Custom error class for Google Auth errors
 */
export class GoogleAuthError extends Error {
  public readonly code: GoogleAuthErrorCode;
  public readonly originalError?: unknown;
  public readonly timestamp: number;

  constructor(
    message: string,
    code: GoogleAuthErrorCode,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GoogleAuthError);
    }
  }

  /**
   * Creates a JSON representation of the error for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * User profile information from Google
 */
export interface GoogleUserProfile {
  /** User's full name */
  name?: string;
  /** User's given name */
  givenName?: string;
  /** User's family name */
  familyName?: string;
  /** User's email address */
  email?: string;
  /** URL to user's profile picture */
  picture?: string;
  /** User's locale */
  locale?: string;
  /** Whether the email is verified */
  emailVerified?: boolean;
}

/**
 * Result of a successful Google authentication
 */
export interface GoogleAuthResult {
  /** The ID token from Google */
  idToken: string;
  /** Decoded user profile (optional, requires calling decodeIdToken separately) */
  user?: GoogleUserProfile;
}

/**
 * Result type from OAuth flow
 */
export type AuthResultType = 'success' | 'dismiss' | 'cancel' | 'error';

/**
 * OAuth discovery document endpoints
 */
export interface OAuthDiscoveryConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string;
}

/**
 * Configuration options for Google OAuth
 */
export interface GoogleOAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  discovery: OAuthDiscoveryConfig;
}

/**
 * Logger interface for dependency injection
 */
export interface AuthLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Creates the redirect URI for OAuth callbacks
 * Uses lazy initialization to support hot reloading in development
 */
function createRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    useProxy: true,
  });
}

/**
 * Gets the OAuth configuration
 * Lazily initializes redirectUri to support hot reloading
 */
function getOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '',
    redirectUri: createRedirectUri(),
    scopes: DEFAULT_SCOPES,
    discovery: {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    },
  };
}

/**
 * Determines if debug mode is enabled
 */
function isDebugMode(): boolean {
  // @ts-ignore - __DEV__ is a global defined by React Native/Expo
  if (typeof __DEV__ !== 'undefined') {
    // @ts-ignore
    return __DEV__;
  }
  return process.env.NODE_ENV === 'development';
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Default console-based logger implementation
 */
function createDefaultLogger(debugEnabled: boolean): AuthLogger {
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (debugEnabled) {
        console.debug(`[GoogleAuth] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      console.info(`[GoogleAuth] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`[GoogleAuth] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`[GoogleAuth] ${message}`, ...args);
    },
  };
}

// Initialize logger
const DEBUG_MODE = isDebugMode();
const logger = createDefaultLogger(DEBUG_MODE);

/**
 * Custom logger instance (can be overridden for testing or custom logging)
 */
let customLogger: AuthLogger | null = null;

/**
 * Get the active logger (custom or default)
 */
function getLogger(): AuthLogger {
  return customLogger ?? logger;
}

/**
 * Set a custom logger for the auth service
 * @param logger - Custom logger implementation
 */
export function setLogger(loggerInstance: AuthLogger): void {
  customLogger = loggerInstance;
}

/**
 * Reset to default logger
 */
export function resetLogger(): void {
  customLogger = null;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that the OAuth configuration is complete
 * @param config - The configuration to validate
 * @throws {GoogleAuthError} If configuration is invalid
 */
function validateConfig(config: GoogleOAuthConfig): void {
  if (!config.clientId || config.clientId.trim() === '') {
    throw new GoogleAuthError(
      'Google OAuth Client ID is not configured. Set EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID environment variable.',
      GoogleAuthErrorCode.CONFIG_ERROR
    );
  }

  if (!config.redirectUri || config.redirectUri.trim() === '') {
    throw new GoogleAuthError(
      'Google OAuth Redirect URI is not configured properly.',
      GoogleAuthErrorCode.CONFIG_ERROR
    );
  }
}

/**
 * Validates an ID token format (basic JWT structure check)
 * @param token - The token to validate
 * @returns true if the token has a valid JWT structure
 */
function isValidIdToken(token: string | undefined): token is string {
  if (typeof token !== 'string' || token.length === 0) {
    return false;
  }

  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

// ============================================================================
// Network Utilities
// ============================================================================

/**
 * Creates an AbortController with a timeout
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with AbortController and timeout cleanup function
 */
function createTimeoutController(timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}

// ============================================================================
// JWT Utilities
// ============================================================================

/**
 * Safely decodes a base64url encoded string
 * @param base64Url - The base64url encoded string
 * @returns The decoded string
 */
function decodeBase64Url(base64Url: string): string {
  // Convert base64url to base64
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

  // Pad with '=' to make length a multiple of 4
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('Invalid base64 string');
    }
    base64 += '='.repeat(4 - pad);
  }

  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/**
 * Decodes the payload from a JWT token
 * Note: This does NOT verify the token signature - validation should be done on the backend
 * @param token - The JWT token to decode
 * @returns The decoded payload as a record
 */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    if (!isValidIdToken(token)) {
      return null;
    }

    const base64Url = token.split('.')[1];
    const jsonPayload = decodeBase64Url(base64Url);
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// ============================================================================
// Main Auth Functions
// ============================================================================

/**
 * Start Google OAuth login flow
 * Returns id_token from Google on success
 * 
 * @throws {GoogleAuthError} If configuration is invalid or auth fails
 * @returns {Promise<GoogleAuthResult | null>} Auth result or null if dismissed
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult | null> {
  const log = getLogger();
  const config = getOAuthConfig();

  try {
    validateConfig(config);
    log.debug('Starting Google OAuth flow');

    const request = new AuthSession.AuthRequest({
      clientId: config.clientId,
      redirectUrl: config.redirectUri,
      responseType: AUTH_RESPONSE_TYPE,
      scopes: config.scopes,
    });

    const result = await request.promptAsync(config.discovery, {
      useProxy: true,
    });

    return handleAuthResult(result);
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      throw error;
    }

    const networkError = error as { code?: string };
    if (networkError.code === 'ECONNABORTED') {
      log.error('Authentication request timeout');
      throw new GoogleAuthError(
        'Authentication request timed out. Please try again.',
        GoogleAuthErrorCode.TIMEOUT_ERROR,
        error
      );
    }

    log.error('Unexpected error during sign in', error);
    throw new GoogleAuthError(
      'An unexpected error occurred during Google authentication',
      GoogleAuthErrorCode.UNKNOWN_ERROR,
      error
    );
  }
}

/**
 * Handles the OAuth result and returns appropriate response
 * @param result - The result from the OAuth flow
 * @returns GoogleAuthResult on success, null on dismiss/cancel
 * @throws {GoogleAuthError} On authentication failure
 */
function handleAuthResult(
  result: AuthSession.AuthSessionResult
): GoogleAuthResult | null {
  const log = getLogger();

  switch (result.type) {
    case 'success': {
      const idToken = result.params.id_token;
      if (isValidIdToken(idToken)) {
        log.info('Login successful');
        return {
          idToken,
        };
      }
      log.error('Invalid ID token received', { tokenLength: idToken?.length });
      throw new GoogleAuthError(
        'Invalid ID token received from Google',
        GoogleAuthErrorCode.INVALID_TOKEN
      );
    }

    case 'dismiss':
      log.debug('User dismissed login');
      return null;

    case 'cancel':
      log.debug('Login cancelled');
      return null;

    default:
      log.error('Login failed with result', { type: result.type });
      throw new GoogleAuthError(
        'Authentication failed',
        GoogleAuthErrorCode.AUTH_FAILED,
        result
      );
  }
}

/**
 * Sign out from Google and revoke the token if provided
 * 
 * @param idToken - Optional ID token to revoke on Google's servers
 * @returns true if token was successfully revoked, false otherwise
 */
export async function signOutFromGoogle(idToken?: string): Promise<boolean> {
  const log = getLogger();
  log.info('Signing out');

  if (!idToken) {
    log.debug('No token provided for revocation, performing local sign out only');
    return true;
  }

  try {
    await revokeToken(idToken);
    return true;
  } catch (error) {
    // Log but don't throw - sign out should not fail the app
    log.error('Error during token revocation in sign out', error);
    return false;
  }
}

/**
 * Revoke a Google OAuth token
 * This invalidates the token on Google's servers
 * 
 * @param token - The token to revoke (ID token)
 * @throws {GoogleAuthError} If revocation fails or token is invalid
 */
export async function revokeToken(token: string): Promise<void> {
  const log = getLogger();
  
  // Validate token is not empty
  if (!token || token.trim() === '') {
    throw new GoogleAuthError(
      'Token is required and cannot be empty',
      GoogleAuthErrorCode.VALIDATION_ERROR
    );
  }

  log.debug('Revoking token');

  const config = getOAuthConfig();
  const { controller, cleanup } = createTimeoutController();

  try {
    const response = await fetch(config.discovery.revocationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(token)}`,
      signal: controller.signal,
    });

    cleanup();

    if (!response.ok) {
      // 400 Bad Request is returned if the token has already been revoked
      if (response.status === 400) {
        log.debug('Token was already revoked or invalid');
        return;
      }

      throw new GoogleAuthError(
        `Token revocation failed with status ${response.status}`,
        GoogleAuthErrorCode.REVOKE_FAILED
      );
    }

    log.info('Token successfully revoked');
  } catch (error) {
    cleanup();

    if (error instanceof GoogleAuthError) {
      throw error;
    }

    if ((error as { name?: string }).name === 'AbortError') {
      log.error('Token revocation request timeout');
      throw new GoogleAuthError(
        'Token revocation request timed out',
        GoogleAuthErrorCode.TIMEOUT_ERROR,
        error
      );
    }

    log.error('Error revoking token', error);
    throw new GoogleAuthError(
      'Failed to revoke token',
      GoogleAuthErrorCode.REVOKE_ERROR,
      error
    );
  }
}

/**
 * Decode a JWT token to extract payload information
 * Note: This does NOT verify the token signature - validation should be done on the backend
 * 
 * @param token - The JWT token to decode
 * @returns The decoded user profile or null if invalid
 */
export function decodeIdToken(token: string): GoogleUserProfile | null {
  const log = getLogger();

  try {
    const payload = decodeJWTPayload(token);
    if (!payload) {
      return null;
    }

    return {
      name: payload.name as string | undefined,
      givenName: payload.given_name as string | undefined,
      familyName: payload.family_name as string | undefined,
      email: payload.email as string | undefined,
      picture: (payload.picture as string | undefined) || (payload.pic as string | undefined),
      locale: payload.locale as string | undefined,
      emailVerified: payload.email_verified as boolean | undefined,
    };
  } catch (error) {
    log.error('Failed to decode ID token', error);
    return null;
  }
}

/**
 * Check if the current platform supports Google OAuth
 */
export function isGoogleOAuthSupported(): boolean {
  return AuthSession.platformSupportsSecureStore();
}

/**
 * Get the current OAuth configuration (useful for debugging)
 * Note: This creates a new config object each time with fresh redirectUri
 */
export function getOAuthConfigExport(): Readonly<GoogleOAuthConfig> {
  return Object.freeze(getOAuthConfig());
}

/**
 * Validates if the auth service is properly configured and ready to use
 * @returns true if configured correctly
 */
export function isConfigured(): boolean {
  try {
    const config = getOAuthConfig();
    validateConfig(config);
    return true;
  } catch {
    return false;
  }
}