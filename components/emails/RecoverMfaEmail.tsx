// components/emails/RecoverMfaEmail.tsx
import React, { CSSProperties } from 'react'
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
} from '@react-email/components'

interface RecoverMfaEmailProps {
  qrCodeUrl: string
  supportEmail: string
}

export default function RecoverMfaEmail({
  qrCodeUrl,
  supportEmail,
}: RecoverMfaEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Recover your MFA setup</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* Logo */}
          <Img
            src={process.env.LOGO_IMAGE_URL ?? "https://your-cdn.com/logo.png"}
            alt="Your App"
            width="48"
            height="48"
            style={styles.logo}
          />

          {/* Title */}
          <Text style={styles.title}>Recover Your MFA Setup</Text>

          {/* Intro */}
          <Text style={styles.text}>
            We received a request to reset your multi-factor authentication.
            Scan the QR code below with your authenticator app (e.g. Google
            Authenticator, Authy) to finish setup.
          </Text>

          {/* QR Code */}
          <Section style={styles.section}>
            <Img
              src={qrCodeUrl}
              alt="MFA QR Code"
              width="200"
              height="200"
              style={styles.qrImage}
            />
          </Section>

          {/* Call-to-Action */}
          <Button
            style={styles.button}
            href={process.env.LOGIN_LINK ?? "http://localhost:3000/login"}
          >
            Go to Your Dashboard
          </Button>

          {/* Footer */}
          <Text style={styles.footer}>
            If you didn’t request this, you can ignore this email or contact us
            at{' '}
            <a href={`mailto:${supportEmail}`} style={styles.link}>
              {supportEmail}
            </a>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles: Record<string, CSSProperties> = {
  main: {
    backgroundColor: '#f5f7fa',
    padding: '20px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    margin: '0 auto',
    padding: '40px 20px',
    maxWidth: '600px',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  logo: {
    display: 'block',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '20px',
  },
  text: {
    fontSize: '16px',
    lineHeight: 1.5,
    margin: '20px 0',
  },
  section: {
    textAlign: 'center',
    margin: '30px 0',
  },
  qrImage: {
    borderRadius: '4px',
  },
  button: {
    display: 'block',
    width: 'fit-content',
    margin: '0 auto',
    padding: '12px 20px',
    backgroundColor: '#000000',
    color: '#ffffff',
    borderRadius: '4px',
    textDecoration: 'none',
    fontWeight: 500,
    textAlign: 'center',
  },
  footer: {
    fontSize: '12px',
    lineHeight: 1.4,
    color: '#666666',
    marginTop: '30px',
    textAlign: 'center',
  },
  link: {
    color: '#1a0dab',
    textDecoration: 'none',
  },
}
