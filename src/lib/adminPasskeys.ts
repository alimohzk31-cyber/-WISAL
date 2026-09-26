import { supabase } from './supabase';

type CredentialDescriptorJSON = {
  id: string;
  type: 'public-key';
  transports?: AuthenticatorTransport[];
};

export interface RegistrationOptionsJSON {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: CredentialDescriptorJSON[];
}

export interface AuthenticationOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: CredentialDescriptorJSON[];
}

type PasskeyResponse = {
  ok?: boolean;
  access_token?: string;
  refresh_token?: string;
  code?: string;
};

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function bufferToBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function credentialDescriptorToBrowser(descriptor: CredentialDescriptorJSON): PublicKeyCredentialDescriptor {
  return {
    id: base64UrlToBytes(descriptor.id),
    type: descriptor.type,
    transports: descriptor.transports,
  };
}

function registrationOptionsToBrowser(options: RegistrationOptionsJSON): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64UrlToBytes(options.challenge),
    user: { ...options.user, id: base64UrlToBytes(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map(credentialDescriptorToBrowser),
  };
}

function authenticationOptionsToBrowser(options: AuthenticationOptionsJSON): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64UrlToBytes(options.challenge),
    allowCredentials: options.allowCredentials?.map(credentialDescriptorToBrowser),
  };
}

function serializeRegistrationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports: response.getTransports?.(),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function serializeAuthenticationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

async function invokePasskey<T extends PasskeyResponse>(body: Record<string, unknown>): Promise<T> {
  const result = await supabase.functions.invoke<T>('admin-passkey', { body });
  if (!result.error && result.data) return result.data;

  if (result.error?.context instanceof Response) {
    try {
      const payload = await result.error.context.clone().json() as PasskeyResponse;
      return { ok: false, code: payload.code ?? 'webauthn_failed' } as T;
    } catch {
      // Fall through to the generic failure below.
    }
  }
  return { ok: false, code: 'network' } as T;
}

function assertBrowserWebAuthn(): void {
  if (typeof window === 'undefined' || !window.isSecureContext || !('PublicKeyCredential' in window) || !navigator.credentials) {
    throw new Error('webauthn_not_supported');
  }
}

export async function authenticateAdminPasskey(): Promise<PasskeyResponse> {
  assertBrowserWebAuthn();
  const optionsResponse = await invokePasskey<AuthenticationOptionsJSON & PasskeyResponse>({ action: 'authentication-options' });
  if (!optionsResponse.challenge) return { ok: false, code: optionsResponse.code ?? 'webauthn_failed' };

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({ publicKey: authenticationOptionsToBrowser(optionsResponse) });
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
      return { ok: false, code: 'passkey_cancelled' };
    }
    return { ok: false, code: 'webauthn_failed' };
  }
  if (!(credential instanceof PublicKeyCredential)) return { ok: false, code: 'webauthn_failed' };

  return invokePasskey<PasskeyResponse>({
    action: 'authentication-verify',
    credential: serializeAuthenticationCredential(credential),
  });
}

export async function registerAdminPasskey(enrollmentToken: string): Promise<PasskeyResponse> {
  if (!enrollmentToken) return { ok: false, code: 'enrollment_not_authorized' };
  assertBrowserWebAuthn();
  const optionsResponse = await invokePasskey<RegistrationOptionsJSON & PasskeyResponse>({
    action: 'registration-options',
    enrollment_token: enrollmentToken,
  });
  if (!optionsResponse.challenge) return { ok: false, code: optionsResponse.code ?? 'webauthn_failed' };

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({ publicKey: registrationOptionsToBrowser(optionsResponse) });
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
      return { ok: false, code: 'passkey_cancelled' };
    }
    return { ok: false, code: 'webauthn_failed' };
  }
  if (!(credential instanceof PublicKeyCredential)) return { ok: false, code: 'webauthn_failed' };

  return invokePasskey<PasskeyResponse>({
    action: 'registration-verify',
    enrollment_token: enrollmentToken,
    credential: serializeRegistrationCredential(credential),
  });
}

export async function isWindowsHelloAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.isSecureContext || !('PublicKeyCredential' in window) || !navigator.credentials) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
