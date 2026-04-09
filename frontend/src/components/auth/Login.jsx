import React, { useEffect, useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { RadioGroup } from "../ui/radio-group";
import { Button } from "../ui/button";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AUTH_API_END_POINT } from "@/utils/constant";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { setLoading, setUser, setToken } from "@/redux/authSlice";
import { persistor } from "@/redux/store";
import { Loader2 } from "lucide-react";

const Login = () => {
  const [input, setInput] = useState({
    email: "",
    password: "",
    role: "",
  });
  const { loading, user } = useSelector((store) => store.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const changeEventHandler = (e) => {
    setInput({ ...input, [e.target.name]: e.target.value });
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    try {
      if (!input.role) {
        toast.error("Please select how you want to login (role).");
        return;
      }
      dispatch(setLoading(true));
      const res = await axios.post(`${AUTH_API_END_POINT}/login`, {
        email: input.email,
        password: input.password,
      });
      // backend returns { token, user: {...} } with role like "ADMIN" / "VENDOR"

      const rawUser = res.data.user;
      const apiRole = String(rawUser.role || "").toUpperCase();
      let mappedRole = "vendor";
      if (apiRole === "ADMIN") mappedRole = "admin";
      else if (apiRole === "PROCUREMENT_OFFICER") mappedRole = "staff";
      else if (apiRole === "VENDOR") mappedRole = "vendor";
      const normalizedUser = {
        ...rawUser,
        role: mappedRole,
      };

      const requestedRole = String(input.role || "").toLowerCase();
      if (requestedRole && requestedRole !== normalizedUser.role) {
        toast.error(
          `This account is registered as "${normalizedUser.role}". Please select the correct role to login.`,
        );
        dispatch(setLoading(false));
        return;
      }

      dispatch(setUser(normalizedUser));
      dispatch(setToken(res.data.token));
      // Ensure axios interceptor can attach the token (it reads from localStorage).
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      // Don’t block navigation on persist I/O — flush in background (login felt slow waiting here).
      void persistor.flush().catch(() => {});

      if (normalizedUser.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
      toast.success("Login successful");
    } catch (error) {
      console.error(error);
      const data = error?.response?.data;
      let msg = null;
      if (typeof data === "string" && data.trim()) {
        msg = data.replace(/<[^>]*>/g, "").trim().slice(0, 240);
      } else if (data && typeof data === "object") {
        const serverMsg = data.message ?? data.error;
        msg =
          (Array.isArray(serverMsg) ? serverMsg.join(", ") : serverMsg) || null;
      }
      if (!msg && error?.response?.status === 403) {
        msg =
          "Sign-in is not allowed yet. If you just registered as a vendor, wait until an administrator approves your account.";
      }
      const st = error?.response?.status;
      if (!msg && (st === 500 || st === 502)) {
        msg =
          "API error while signing in. Run the backend until the terminal shows the server port, restart the frontend dev server if you changed backend/.env PORT, then try again.";
      }
      toast.error(msg || error?.message || "Login failed");
    } finally {
      dispatch(setLoading(false));
    }
  };
  useEffect(() => {
    if (user) {
      const role = String(user.role || "").toLowerCase();
      if (role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    }
  }, [user, navigate]);
  return (
    <div className="w-full flex-1 bg-[#f6faff]">
      <div className="max-w-6xl mx-auto py-10 px-4">
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(11,31,77,0.12)] overflow-hidden grid md:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]">
          {/* Left panel – welcome + form */}
          <div className="px-6 sm:px-10 py-8 sm:py-10 space-y-6">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase mb-2">
                Paropakar VendorNet
              </h2>
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-1">
                Welcome back
              </h1>
            </div>

            <form onSubmit={submitHandler} className="space-y-4">
              <div>
                <Label className="text-xs">Email address</Label>
                <Input
                  type="email"
                  value={input.email}
                  name="email"
                  onChange={changeEventHandler}
                  placeholder="you@example.org"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <Input
                  type="password"
                  value={input.password}
                  name="password"
                  onChange={changeEventHandler}
                  placeholder="Enter your password"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs block mb-1">Login as</Label>
                <RadioGroup className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={input.role === "admin"}
                      onChange={changeEventHandler}
                      className="cursor-pointer h-3 w-3"
                    />
                    <span>Administrator</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Input
                      type="radio"
                      name="role"
                      value="staff"
                      checked={input.role === "staff"}
                      onChange={changeEventHandler}
                      className="cursor-pointer h-3 w-3"
                    />
                    <span>Procurement Staff</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Input
                      type="radio"
                      name="role"
                      value="vendor"
                      checked={input.role === "vendor"}
                      onChange={changeEventHandler}
                      className="cursor-pointer h-3 w-3"
                    />
                    <span>Vendor</span>
                  </label>
                </RadioGroup>
              </div>
              {loading ? (
                <Button className="w-full mt-3 h-10">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait
                </Button>
              ) : (
                <Button type="submit" className="w-full mt-3 h-10">
                  Login
                </Button>
              )}
              <p className="text-[11px] text-slate-500 pt-1">
                By logging in, you confirm you will follow your
                organization&apos;s procurement and transparency policies when
                using Paropakar VendorNet.
              </p>
              <p className="text-xs text-slate-600">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="text-primary hover:underline">
                  Register as a vendor
                </Link>
              </p>
            </form>
          </div>

          {/* Right panel – visual */}
          <div className="hidden md:flex items-center justify-center bg-[#0b1f4d]">
            <div className="mx-8 my-8 flex flex-col items-center justify-center gap-6">
              <img
                src="/Logo.png"
                alt="Paropakar VendorNet"
                className="h-24 w-24 object-contain"
              />
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white">
                  Paropakar <span className="text-[#5eead4]">VendorNet</span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  NGO Procurement Workspace
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
