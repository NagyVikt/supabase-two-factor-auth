'use server'

import { createClient } from '@/lib/supabase/browser' // Ensure you're using the server client
import { createAdminClient } from '@/lib/supabase/admin.server'
import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'

// Define a clear result interface for type safety
interface RecoverMfaResult {
  success: boolean
  error?: string
}

export const recoverMfa = async (): Promise<RecoverMfaResult> => {
  // Use a try/catch block for robust error handling
  try {
    // 1. Initialize Supabase clients within the action
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // 2. Get the authenticated user from the server client
    // This is secure and automatically handles the session from the request context
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('MFA Recovery Error: User not authenticated.')
      return { success: false, error: 'Authentication failed. Please log in again.' }
    }

    // 3. List and delete all existing TOTP factors for the user
    // This requires the admin client to bypass RLS and MFA policies
    const { data: listData, error: listError } =
      await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id })

    if (listError) {
      console.error(`MFA Recovery Error: Could not list factors for user ${user.id}`, listError)
      return { success: false, error: 'Failed to retrieve existing MFA settings.' }
    }
    
    // Filter for only TOTP factors before attempting deletion
    const totpFactors = listData.all.filter((f) => f.factor_type === 'totp');
    
    for (const factor of totpFactors) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        userId: user.id,
        id: factor.id,
      })
      if (deleteError) {
        console.error(`MFA Recovery Error: Could not delete factor ${factor.id} for user ${user.id}`, deleteError)
        return { success: false, error: 'Failed to remove an old MFA setting.' }
      }
    }

    // 4. Enroll a new TOTP factor for the user
    const { data: enrollData, error: enrollError } =
      await supabase.auth.mfa.enroll({
        factorType: 'totp',
      })

    if (enrollError || !enrollData) {
      console.error(`MFA Recovery Error: Could not enroll new factor for user ${user.id}`, enrollError)
      return { success: false, error: 'Could not create a new MFA setup.' }
    }

    // 5. Configure SMTP transporter using environment variables
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MFA_EMAIL_FROM, SUPPORT_EMAIL } = process.env

    if (!SMTP_HOST || !MFA_EMAIL_FROM) {
      console.error('MFA Recovery Error: Missing required SMTP environment variables (SMTP_HOST, MFA_EMAIL_FROM)')
      return { success: false, error: 'Server configuration error prevents sending email.' }
    }
    
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false, // Use true in production with valid certs
      },
    })

    // 6. Render the email template and send the email
    const emailHtml = render(
      <RecoverMfaEmail
        qrCodeUrl={enrollData.totp.qr_code}
        supportEmail={SUPPORT_EMAIL || 'support@example.com'}
      />
    )

    await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Your App'} Support" <${MFA_EMAIL_FROM}>`,
      to: user.email!,
      subject: 'MFA Recovery for Your Account',
      html: emailHtml,
    })
    
    return { success: true }

  } catch (error: any) {
    console.error('An unexpected error occurred during MFA recovery:', error)
    return { success: false, error: 'An unexpected server error occurred.' }
  }
}
