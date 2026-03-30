import React, { useEffect, useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AUTH_API_END_POINT, VENDOR_CATEGORIES } from "@/utils/constant";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { setLoading } from "@/redux/authSlice";
import { Loader2 } from "lucide-react";

const Signup = () => {
  const [input, setInput] = useState({
    fullname: "",
    email: "",
    phoneNumber: "",
    password: "",
    department: "",
    designation: "",
    address: "",
    description: "",
    website: "",
    category: "other",
    taxId: "",
    businessLicense: "",
    contactPersonName: "",
    contactPersonEmail: "",
    contactPersonPhone: "",
  });
  const [logoFile, setLogoFile] = useState(null);
  const { loading, user } = useSelector((store) => store.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const changeEventHandler = (e) => {
    setInput({ ...input, [e.target.name]: e.target.value });
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("fullname", input.fullname);
    formData.append("email", input.email);
    formData.append("phoneNumber", input.phoneNumber);
    formData.append("password", input.password);
    formData.append("department", input.department);
    if (input.designation) formData.append("designation", input.designation);
    if (input.address) formData.append("address", input.address);
    if (input.description) formData.append("description", input.description);
    if (input.website) formData.append("website", input.website);
    formData.append("category", input.category);
    if (input.taxId) formData.append("taxId", input.taxId);
    if (input.businessLicense)
      formData.append("businessLicense", input.businessLicense);
    if (
      input.contactPersonName ||
      input.contactPersonEmail ||
      input.contactPersonPhone
    ) {
      formData.append("contactPersonName", input.contactPersonName);
      formData.append("contactPersonEmail", input.contactPersonEmail);
      formData.append("contactPersonPhone", input.contactPersonPhone);
    }
    if (logoFile) formData.append("logo", logoFile);

    try {
      dispatch(setLoading(true));
      const res = await axios.post(`${AUTH_API_END_POINT}/register`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      if (res.data.success) {
        navigate("/login");
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const data = error?.response?.data;
      let msg =
        data?.message ||
        error?.message ||
        "Could not register. Is the backend running? If you use a custom API port, set VITE_PROXY_TARGET in frontend/.env (e.g. http://127.0.0.1:3000).";
      if (Array.isArray(msg)) msg = msg.join(", ");
      toast.error(String(msg));
    } finally {
      dispatch(setLoading(false));
    }
  };

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const req = (label) => (
    <>
      {label}{" "}
      <span className="text-red-500" aria-hidden>
        *
      </span>
    </>
  );

  return (
    <div className="w-full flex-1 bg-slate-100">
      <div className="max-w-6xl mx-auto py-10 px-4">
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] overflow-hidden grid md:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]">
          <div className="px-6 sm:px-10 py-8 sm:py-10">
            <div className="mb-6 space-y-1">
              <h2 className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
                Vendor onboarding
              </h2>
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                Register as a new vendor
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Submit your organization details for review. Admins and
                procurement officers are created inside the system.
              </p>
            </div>
            <form onSubmit={submitHandler} className="space-y-4 text-sm">
              <div>
                <Label className="text-xs">{req("Full name")}</Label>
                <Input
                  type="text"
                  value={input.fullname}
                  name="fullname"
                  onChange={changeEventHandler}
                  placeholder="Your name"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{req("Password")}</Label>
                <Input
                  type="password"
                  value={input.password}
                  name="password"
                  onChange={changeEventHandler}
                  placeholder="Create a strong password"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{req("Organization name")}</Label>
                <Input
                  type="text"
                  value={input.department}
                  name="department"
                  onChange={changeEventHandler}
                  placeholder="Your organization name"
                  required
                  className="mt-1"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">{req("Email")}</Label>
                  <Input
                    type="email"
                    value={input.email}
                    name="email"
                    onChange={changeEventHandler}
                    placeholder="you@example.org"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{req("Phone")}</Label>
                  <Input
                    type="text"
                    value={input.phoneNumber}
                    name="phoneNumber"
                    onChange={changeEventHandler}
                    placeholder="+977-98XXXXXXXX"
                    required
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Your position</Label>
                <Input
                  type="text"
                  value={input.designation}
                  name="designation"
                  onChange={changeEventHandler}
                  placeholder="Owner / Manager (optional)"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Address</Label>
                <Input
                  type="text"
                  value={input.address}
                  name="address"
                  onChange={changeEventHandler}
                  placeholder="Street, city"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select
                  name="category"
                  value={input.category}
                  onChange={changeEventHandler}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {VENDOR_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <textarea
                  name="description"
                  value={input.description}
                  onChange={changeEventHandler}
                  rows={3}
                  placeholder="Briefly describe your business"
                  className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input
                  type="url"
                  value={input.website}
                  name="website"
                  onChange={changeEventHandler}
                  placeholder="https://"
                  className="mt-1"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Tax ID</Label>
                  <Input
                    type="text"
                    value={input.taxId}
                    name="taxId"
                    onChange={changeEventHandler}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Business license</Label>
                  <Input
                    type="text"
                    value={input.businessLicense}
                    name="businessLicense"
                    onChange={changeEventHandler}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Logo (optional)</Label>
                <Input
                  accept="image/*"
                  type="file"
                  onChange={(e) =>
                    setLogoFile(e.target.files?.[0] ?? null)
                  }
                  className="mt-1 cursor-pointer"
                />
              </div>
              <fieldset className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-xs font-medium text-slate-700">
                  Contact person (optional)
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Input
                    type="text"
                    name="contactPersonName"
                    placeholder="Name"
                    value={input.contactPersonName}
                    onChange={changeEventHandler}
                  />
                  <Input
                    type="email"
                    name="contactPersonEmail"
                    placeholder="Email"
                    value={input.contactPersonEmail}
                    onChange={changeEventHandler}
                  />
                  <Input
                    type="text"
                    name="contactPersonPhone"
                    placeholder="Phone"
                    value={input.contactPersonPhone}
                    onChange={changeEventHandler}
                  />
                </div>
              </fieldset>
              <p className="text-[11px] text-slate-500">
                After you submit, an administrator must approve your vendor
                application before you can sign in.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {loading ? (
                  <Button type="button" disabled className="h-10">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Please wait
                  </Button>
                ) : (
                  <Button type="submit" className="h-10 bg-slate-900 hover:bg-slate-800">
                    Submit for approval
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-slate-600 pt-1">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Login
                </Link>
              </p>
            </form>
          </div>

          <div className="hidden md:flex items-center justify-center bg-slate-900">
            <div className="mx-8 my-8 flex flex-col items-center justify-center gap-6">
              <img src="/Logo.png" alt="Paropakar VendorNet" className="h-24 w-24 object-contain" />
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white">Paropakar <span className="text-teal-400">VendorNet</span></h2>
                <p className="text-sm text-slate-400 mt-1">Join our vendor network</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
