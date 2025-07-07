// components/emails/RecoverMfaEmail.tsx
import React, { CSSProperties } from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Img,
  Button,
  Hr,
  Link,
} from '@react-email/components';

interface RecoverMfaEmailProps {
  recoveryLink: string;
  supportEmail: string;
  appName: string; // Added for personalization
}

/**
 * An improved email template for MFA recovery.
 * It has a cleaner design and a single, clear call-to-action.
 */
export default function RecoverMfaEmail({
  recoveryLink,
  supportEmail,
  appName = 'Your App', // Default value
}: RecoverMfaEmailProps) {
  const previewText = `Reset your ${appName} two-factor authentication`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={process.env.LOGO_IMAGE_URL ?? `https://placehold.co/100x100/000000/FFFFFF?text=${appName.charAt(0)}`}
              alt={`${appName} Logo`}
              width="48"
              height="48"
            />
          </Section>

          <Text style={styles.title}>
            Reset Two-Factor Authentication
          </Text>

          <Text style={styles.text}>
            We received a request to reset the two-factor authentication for your
            account with {appName}.
          </Text>

          <Text style={styles.text}>
            To proceed, click the button below. This link is valid for 15 minutes.
          </Text>

          <Section style={styles.buttonContainer}>
            <Button style={styles.button} href={recoveryLink}>
              Reset My Authenticator
            </Button>
          </Section>

          <Text style={styles.text}>
            If you did not request this, please disregard this email. Your account
            remains secure.
          </Text>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This email was sent to you because of a recovery request on {appName}.
              If you have any questions, please contact our support team at{' '}
              <Link href={`mailto:${supportEmail}`} style={styles.footerLink}>
                {supportEmail}
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0 48px',
    marginBottom: '64px',
    border: '1px solid #e6ebf1',
    borderRadius: '8px',
  },
  header: {
    padding: '0 48px',
  },
  title: {
    fontSize: '24px',
    lineHeight: '1.25',
    fontWeight: '600',
    color: '#212121',
    padding: '0 48px',
  },
  text: {
    fontSize: '16px',
    lineHeight: '1.5',
    color: '#525f7f',
    padding: '0 48px',
  },
  buttonContainer: {
    padding: '24px 48px',
  },
  button: {
    backgroundColor: '#000000',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center',
    display: 'block',
    width: '100%',
    padding: '14px 0',
  },
  hr: {
    borderColor: '#e6ebf1',
    margin: '20px 0',
  },
  footer: {
    padding: '0 48px',
  },
  footerText: {
    color: '#8898aa',
    fontSize: '12px',
    lineHeight: '1.5',
  },
  footerLink: {
    color: '#8898aa',
    textDecoration: 'underline',
  },
};
