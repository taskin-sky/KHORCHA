import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Logo from "../components/Logo";
import { api } from "../services/api";
import { useAuth } from "../store/auth";

export default function ForgotPassword() {
  const user = useAuth((state) => state.user);
  const setSession = useAuth((state) => state.setSession);
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = form.get("newPassword");
    if (newPassword !== form.get("confirmPassword")) {
      return toast.error("Passwords do not match");
    }

    setSaving(true);
    try {
      const response = await api.post("/auth/forgot-password", {
        email: form.get("email"),
        forgetKey: form.get("forgetKey"),
        newPassword,
      });
      setSession(response.data.user, response.data.token, true);
      toast.success("Password changed successfully");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <Logo />
        <div>
          <p className="eyebrow">ACCOUNT RECOVERY</p>
          <h1>Get back to<br />your finances.</h1>
          <p>Verify your account and choose a new password.</p>
        </div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <p className="eyebrow">RESET PASSWORD</p>
        <h2>Forgot your password?</h2>
        <p className="muted">Enter your email, forget key and a new password.</p>
        <label>Email<input name="email" type="email" required autoFocus placeholder="you@example.com" /></label>
        <label>Forget key<input name="forgetKey" required placeholder="Enter forget key" /></label>
        <label>New password<div className="password"><input name="newPassword" type={show ? "text" : "password"} minLength="8" maxLength="72" required placeholder="At least 8 characters" /><button type="button" onClick={() => setShow(!show)} aria-label="Toggle password">{show ? <EyeOff /> : <Eye />}</button></div></label>
        <label>Confirm password<input name="confirmPassword" type={show ? "text" : "password"} minLength="8" maxLength="72" required placeholder="Repeat new password" /></label>
        <button disabled={saving} className="btn primary" type="submit">{saving ? "Please wait…" : "Reset & sign in"}</button>
        <p className="switch"><Link to="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
