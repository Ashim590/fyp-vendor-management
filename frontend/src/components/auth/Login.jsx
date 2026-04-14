import React, { useEffect, useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AUTH_API_END_POINT } from "@/utils/constant";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { setLoading, setUser, setToken } from "@/redux/authSlice";
import { persistor } from "@/redux/store";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SESSION_ROLE, mapApiRoleToSession } from "@/constants/userRoles";
import { getApiErrorMessage } from "@/utils/apiError";

const Login = () => {
  const [input, setInput] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const { loading, user } = useSelector((store) => store.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const changeEventHandler = (e) => {
    setInput({ ...input, [e.target.name]: e.target.value });
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    try {
      dispatch(setLoading(true));
      const res = await axios.post(`${AUTH_API_END_POINT}/login`, {
        email: input.email,
        password: input.password,
      });
      // Login payload mirrors JWT: uppercase role strings before we map to session slugs.

      const rawUser = res.data.user;
      const mappedRole = mapApiRoleToSession(rawUser.role);
      const normalizedUser = {
        ...rawUser,
        role: mappedRole,
      };

      dispatch(setUser(normalizedUser));
      dispatch(setToken(res.data.token));
      // The interceptor reads `token` from localStorage on the next request, so it must exist before navigation.
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      // Persist can lag disk I/O; flushing in the background kept login from feeling stuck.
      void persistor.flush().catch(() => {});

      if (normalizedUser.role === SESSION_ROLE.ADMIN) {
        navigate("/admin");
      } else {
        navigate("/");
      }
      toast.success("Login successful");
    } catch (error) {
      console.error(error);
      toast.error(
        getApiErrorMessage(error, "Login failed", {
          forbiddenHint:
            "Sign-in is not allowed yet. If you just registered as a vendor, wait until an administrator approves your account.",
          serverErrorHint:
            "API error while signing in. Run the backend until the terminal shows the server port, restart the frontend dev server if you changed backend/.env PORT, then try again.",
        }),
      );
    } finally {
      dispatch(setLoading(false));
    }
  };
  useEffect(() => {
    if (user) {
      const role = String(user.role || "").toLowerCase();
      if (role === SESSION_ROLE.ADMIN) {
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
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={input.password}
                    name="password"
                    onChange={changeEventHandler}
                    placeholder="Enter your password"
                    className="pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
