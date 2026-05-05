---
title: Change Password
excerpt: Learn how to implement secure password change functionality in your application.
---

## Overview

Implementing a secure password change feature is crucial for maintaining user account security. This guide covers best practices and implementation details.

## Implementation

### 1. Password Change Form [step]

Create a secure password change form:

```typescript
function ChangePasswordForm() {
const [passwords, setPasswords] = useState({
  current: '',
  new: '',
  confirm: ''
})

const handleSubmit = async (e) => {
  e.preventDefault()
  if (passwords.new !== passwords.confirm) {
    return setError('New passwords do not match')
  }

  try {
    await updatePassword(passwords)
    showSuccess('Password updated successfully')
  } catch (error) {
    setError(error.message)
  }
}

return (
  <form onSubmit={handleSubmit}>
    <input
      type="password"
      value={passwords.current}
      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
      placeholder="Current Password"
    />
    {/* New password and confirmation fields */}
  </form>
)
}
```

### 2. Password Validation [step]

Implement strong password validation:

```typescript
function validatePassword(password: string): ValidationResult {
  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*]/.test(password),
  };

  return {
    isValid: Object.values(requirements).every(Boolean),
    requirements,
  };
}
```

## Security Features

Password changes should be treated as a high-risk workflow. The items below help prevent brute force, credential stuffing, and accidental lockouts.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Password Hashing"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Implement secure password hashing:
    ```typescript
    import { hash, compare } from 'bcrypt'
    
    async function hashPassword(password: string): Promise<string> {
      const saltRounds = 10
      return await hash(password, saltRounds)
    }
    
    async function verifyPassword(password: string, hash: string): Promise<boolean> {
      return await compare(password, hash)
    }
    ```
  </AccordionItem>
  <AccordionItem
    label="Rate Limiting"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Protect against brute force attacks:
    ```typescript
    const rateLimit = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5 // limit each IP to 5 requests per windowMs
    }
    
    app.use('/api/change-password', createRateLimiter(rateLimit))
    ```
  </AccordionItem>
</Accordion>

## Best Practices

Use these practices as a baseline for production. They reduce account takeovers and make support incidents easier to resolve.

<Admonition>
  Follow these security best practices: - Never store plain-text passwords -
  Implement rate limiting - Use secure password hashing - Require current
  password verification - Send email notifications for password changes
</Admonition>

## Error Handling

Make failures explicit and safe. Avoid leaking sensitive details, but keep error messages actionable for the user.

```typescript
async function handlePasswordChange(data) {
  try {
    // Verify current password
    const isValid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const validation = validatePassword(data.newPassword);
    if (!validation.isValid) {
      throw new Error('New password does not meet requirements');
    }

    // Update password
    const newHash = await hashPassword(data.newPassword);
    await updateUserPassword(user.id, newHash);

    // Send notification
    await sendPasswordChangeNotification(user.email);
  } catch (error) {
    // Handle errors appropriately
    throw new Error(`Failed to change password: ${error.message}`);
  }
}
```

## Security Considerations

Security considerations are the “guardrails” around the happy path. They matter most when a flow is abused or fails.

- Implement proper session management
- Use HTTPS for all password-related operations
- Implement account lockout after failed attempts
- Send notifications for password changes
- Log security-related events

## Next Steps

If your product supports high-value accounts, consider 2FA as the next layer of protection.

<Grid>
  <Card
    title="Two-Factor Authentication"
    description="Enhance account security with 2FA."
    linkUrl="/docs/architecture/settings/security/two-factor-authentication"
    linkText="2FA Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Profile Settings"
    description="Manage user profile and preferences."
    linkUrl="/docs/architecture/settings/profile"
    linkText="Profile Guide" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
