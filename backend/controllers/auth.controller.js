import db from "../db.js";
import * as usersModel from "../models/users.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { sendMailViaGraph } from "../integrations/outlook/graph_client.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

async function sendPasswordResetOtpEmail(toEmail, otp) {
  const subject = "Your RIDE+ Password Reset OTP";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px;font-size:18px">RIDE+ Password Reset</h2>
      <p style="margin:0 0 12px">Use this one-time password to reset your account password:</p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>
      <p style="margin:0;color:#64748b;font-size:13px">This OTP expires in 10 minutes. If you did not request a reset, you can ignore this email.</p>
    </div>
  `;

  // Use Microsoft Graph only (SMTP EMAIL_USER/EMAIL_PASS auth is broken / 535)
  await sendMailViaGraph({
    to: toEmail,
    subject,
    htmlContent: html,
  });
}

export async function loginHandler(req, res) {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const emailLower = email.toLowerCase().trim();


    if (!emailLower.endsWith("@arche.global")) {
      return res.status(403).json({ success: false, message: "Access restricted to @arche.global domain" });
    }


    // Accounts (ADMIN, PM, or otherwise) exist only if provisioned in the
    // database — via the Admin > Add User screen, or the BM approval flow.
    // No credentials are hardcoded or auto-created here.
    let user = await usersModel.findByEmail(emailLower);


    if (!user) {
      return res.status(403).json({ success: false, message: "Access Denied: Account not found or not approved." });
    }


    if (!user.password_hash) {
      return res.status(200).json({
        success: true,
        isFirstLogin: true,
        message: "Welcome! Please set your password to continue.",
        role: user.role
      });
    }


    if (!password) return res.status(400).json({ success: false, message: "Password required" });

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    return sendLoginResponse(res, user);

  } catch (err) {
    console.error("Login error", err);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
}


function sendLoginResponse(res, user) {

  if (user.password_updated_at) {
    const lastUpdate = new Date(user.password_updated_at);
    const now = new Date();
    const diffInDays = (now - lastUpdate) / (1000 * 60 * 60 * 24);

    if (diffInDays > 90) {
      return res.status(200).json({
        success: false,
        passwordExpired: true,
        message: "Your password has expired (90 days). Please update it."
      });
    }
  }

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

  return res.status(200).json({
    success: true,
    isFirstLogin: false,
    data: { token, user: payload },
  });
}


export async function approveBMHandler(req, res) {
  try {



    const { bmEmail } = req.body;

    if (!bmEmail) {
      return res.status(400).json({ success: false, message: "BM Email is required" });
    }

    const bmEmailLower = bmEmail.toLowerCase().trim();

    if (!bmEmailLower.endsWith("@arche.global")) {
      return res.status(400).json({ success: false, message: "Only @arche.global emails allowed for BM" });
    }


    const existingBM = await usersModel.findByEmail(bmEmailLower);
    if (existingBM) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }


    await usersModel.createUser({
      name: bmEmailLower.split("@")[0],
      email: bmEmailLower,
      password_hash: "",
      role: "BM"
    });

    return res.status(200).json({ success: true, message: `Success! BM Account for ${bmEmailLower} is approved.` });

  } catch (err) {
    console.error("Approve BM Error", err);
    return res.status(500).json({ success: false, message: "Failed to approve BM" });
  }
}


export async function resetPasswordExpiredHandler(req, res) {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
    const emailLower = email.toLowerCase().trim();

    const user = await usersModel.findByEmail(emailLower);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });


    if (user.password_hash) {
      if (!oldPassword) return res.status(400).json({ success: false, message: "Old password required" });

      const oldPasswordOk = await bcrypt.compare(oldPassword, user.password_hash);
      if (!oldPasswordOk) {
        return res.status(401).json({ success: false, message: "Incorrect old password" });
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await usersModel.updatePassword(user.id, newPasswordHash);

    return res.status(200).json({ success: true, message: "Password set successfully." });

  } catch (err) {
    console.error("Reset password error", err);
    return res.status(500).json({ success: false, message: "Failed to reset password" });
  }
}


export async function getApprovedBMsHandler(req, res) {
  try {

    const result = await usersModel.listAllUsers();

    const bms = result.filter(u => u.role === "BM" || u.role === "PM");


    bms.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));


    const data = bms.map(u => ({
      email: u.email,
      approvedAt: u.created_at
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Get Approved BMs Error", err);
    return res.status(500).json({ success: false, message: "Failed to fetch BMs" });
  }
}

export async function forgotPasswordOtpHandler(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Auto-migrate if the columns don't exist yet
    try {
      await db.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20),
          ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(10),
          ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP
      `);
    } catch (e) {
      console.log("Migration check failed:", e.message);
    }

    const emailLower = email.toLowerCase().trim();
    const user = await usersModel.findByEmail(emailLower);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await usersModel.saveOtp(user.id, otp, null);

    // Deliver OTP only to the email entered on the login form — never log the code
    try {
      await sendPasswordResetOtpEmail(emailLower, otp);
      console.log(`[ForgotPassword] OTP email sent to ${emailLower}`);
    } catch (emailErr) {
      console.error("[ForgotPassword] Failed to send OTP email:", emailErr.message);
      await usersModel.clearOtp(user.id);
      return res.status(502).json({
        success: false,
        message: "Could not send OTP email. Please try again later or contact an admin.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${emailLower}`,
    });
  } catch (err) {
    console.error("Forgot password OTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to process request" });
  }
}

export async function resetPasswordOtpHandler(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const emailLower = email.toLowerCase().trim();
    const user = await usersModel.findByEmail(emailLower);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify OTP from database (you need to query the user's OTP directly or add a method for it)
    // Since findByEmail does a SELECT *, it might not have the newly added columns if we didn't restart or if they weren't in schema, wait, findByEmail does SELECT * so it will have them.
    if (!user.reset_otp || user.reset_otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > new Date(user.reset_otp_expires_at)) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await usersModel.updatePassword(user.id, newPasswordHash);
    await usersModel.clearOtp(user.id);

    return res.status(200).json({ success: true, message: "Password reset successfully!" });
  } catch (err) {
    console.error("Reset password OTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to reset password" });
  }
}
