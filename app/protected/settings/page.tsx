"use client";

import { enrollMFA } from "@/lib/actions/mfa/enrollMfa";
import { verifyMFA } from "@/lib/actions/mfa/verifyMfa";
import { unEnrollMFA } from "@/lib/actions/mfa/unEnrollMfa";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Settings() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleEnroll = async () => {
    const mfa = await enrollMFA();
    setQrCode(mfa.totp.qr_code);
  };

  const handleUnenroll = async () => {
    await unEnrollMFA();
    setQrCode(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Secure your account with an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {!qrCode ? (
            <Button onClick={handleEnroll} className="self-start">
              Enable 2FA
            </Button>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2">
                <img src={qrCode} alt="MFA QR Code" width={180} height={180} />
                <p className="text-xs text-muted-foreground">
                  Scan this QR code with your authenticator app
                </p>
              </div>
              <form action={verifyMFA} className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="verifyCode">Verification code</Label>
                  <Input
                    id="verifyCode"
                    name="verifyCode"
                    placeholder="Enter your code"
                    required
                  />
                </div>
                <Button type="submit" className="self-start">
                  Verify
                </Button>
              </form>
              <Button
                variant="destructive"
                onClick={handleUnenroll}
                className="self-start"
              >
                Disable 2FA
              </Button>
            </>
          )}
          {message && (
            <p className="text-sm text-red-500">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
