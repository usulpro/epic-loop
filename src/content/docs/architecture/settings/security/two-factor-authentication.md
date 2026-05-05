---
title: Two-Factor Authentication
excerpt: Learn how to implement secure two-factor authentication (2FA) in your application.
---

## Overview

Two-Factor Authentication (2FA) adds an extra layer of security by requiring users to provide two different forms of identification before accessing their account.

## Implementation

### 1. Setup 2FA [step]

Implement 2FA setup process:

```typescript
import QRCode from 'qrcode';
import { generateSecret, generateToken, verifyToken } from 'speakeasy';

async function setup2FA(userId: string) {
  // Generate secret
  const secret = generateSecret({
    name: 'YourApp',
    issuer: 'YourCompany',
  });

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Store secret securely
  await updateUser(userId, {
    twoFactorSecret: secret.base32,
    twoFactorEnabled: false,
  });

  return { secret: secret.base32, qrCode };
}
```

### 2. Verify Setup [step]

Verify the 2FA setup:

```typescript
async function verify2FASetup(userId: string, token: string) {
  const user = await getUser(userId);

  const isValid = verifyToken(user.twoFactorSecret, token);
  if (isValid) {
    await updateUser(userId, { twoFactorEnabled: true });
    return true;
  }
  return false;
}
```

## Authentication Flow

2FA changes your login workflow. Start simple: verify credentials first, then prompt for a second factor only when enabled for the user.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Login Process"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Handle 2FA during login:
    ```typescript
    async function loginWith2FA(email: string, password: string, token?: string) {
      // First step: Verify credentials
      const user = await verifyCredentials(email, password)
      
      if (user.twoFactorEnabled) {
        if (!token) {
          return {
            requiresSecondFactor: true,
            tempToken: generateTempToken(user.id)
          }
        }
        
        // Verify 2FA token
        const isValid = verifyToken(user.twoFactorSecret, token)
        if (!isValid) {
          throw new Error('Invalid 2FA token')
        }
      }
      
      return generateSessionToken(user)
    }
    ```
  </AccordionItem>
  <AccordionItem
    label="Backup Codes"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Generate and manage backup codes:
    ```typescript
    function generateBackupCodes(): string[] {
      const codes = []
      for (let i = 0; i < 10; i++) {
        codes.push(crypto.randomBytes(4).toString('hex'))
      }
      return codes
    }
    
    async function storeBackupCodes(userId: string, codes: string[]) {
      const hashedCodes = codes.map(code => hashCode(code))
      await updateUser(userId, { backupCodes: hashedCodes })
    }
    ```
  </AccordionItem>
</Accordion>

## Recovery Options

Recovery is part of the product, not an afterthought. Backup codes and account recovery paths reduce lockouts and support load.

<Admonition>
    Always provide users with backup options in case they lose access to their 2FA device.
</Admonition>

```typescript
async function useBackupCode(userId: string, code: string) {
  const user = await getUser(userId);
  const hashedCode = hashCode(code);

  const validCode = user.backupCodes.includes(hashedCode);
  if (validCode) {
    // Remove used backup code
    await removeBackupCode(userId, hashedCode);
    return generateSessionToken(user);
  }

  throw new Error('Invalid backup code');
}
```

## Security Best Practices

These practices protect both the user and your platform. They also make audits easier because behavior becomes predictable.

- Store 2FA secrets securely
- Implement rate limiting for token verification
- Provide backup codes during setup
- Allow users to disable/re-enable 2FA
- Send notifications for 2FA changes

## User Interface

The UI should guide users through setup and verification. Keep the steps clear and avoid exposing secrets beyond the QR code/seed display.

```typescript
function TwoFactorSetup() {
  const [step, setStep] = useState('initial')
  const [qrCode, setQrCode] = useState('')

  const handleSetup = async () => {
    const { qrCode, secret } = await setup2FA(userId)
    setQrCode(qrCode)
    setStep('verify')
  }

  return (
    <div>
      {step === 'initial' && (
        <button onClick={handleSetup}>
          Enable 2FA
        </button>
      )}
      {step === 'verify' && (
        <div>
          <img src={qrCode} alt="QR Code" />
          <TokenVerificationForm />
        </div>
      )}
    </div>
  )
}
```

## Error Handling

Error handling should be strict but friendly: reject malformed tokens, rate-limit repeated failures, and log attempts for audit.

```typescript
async function verify2FAToken(token: string) {
  try {
    if (!token.match(/^\d{6}$/)) {
      throw new Error('Invalid token format');
    }

    const isValid = await verifyToken(token);
    if (!isValid) {
      throw new Error('Invalid token');
    }

    return true;
  } catch (error) {
    logAuthenticationAttempt(userId, '2fa_failure');
    throw new Error(`2FA verification failed: ${error.message}`);
  }
}
```

## Next Steps

After 2FA is in place, review other account security workflows like password changes and profile security settings.

<Grid>
  <Card
    title="Change Password"
    description="Learn how to implement secure password changes."
    linkUrl="/docs/architecture/settings/security/change-password"
    linkText="Password Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Profile Settings"
    description="Manage user profile and security preferences."
    linkUrl="/docs/architecture/settings/profile"
    linkText="Profile Guide" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
