import React, { useEffect, useRef, useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AUTH_API_END_POINT, VENDOR_CATEGORIES } from "@/utils/constant";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { setLoading } from "@/redux/authSlice";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  UserCircle2,
} from "lucide-react";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

const fieldLabel = "text-sm font-medium text-slate-800";
const optionalHint = "text-slate-500 font-normal";

const TOTAL_STEPS = 2;

const STEP1_LABELS = {
  organizationName: "Organization name",
  email: "Work email",
  password: "Password",
  phoneNumber: "Phone",
  address: "Street address",
  province: "Province",
  district: "District",
};

const FormSection = ({ icon: Icon, title, description, children, className }) => (
  <section
    className={cn(
      "rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5",
      className,
    )}
  >
    <div className="mb-4 flex gap-3">
      {Icon && (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b1f4d]/[0.06] text-[#0b1f4d]"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        )}
      </div>
    </div>
    <div className="space-y-3.5">{children}</div>
  </section>
);

const Signup = () => {
  const formScrollRef = useRef(null);
  const [step, setStep] = useState(1);
  const [input, setInput] = useState({
    email: "",
    phoneNumber: "",
    password: "",
    organizationName: "",
    address: "",
    province: "",
    district: "",
    description: "",
    website: "",
    category: "other",
    panNumber: "",
    registrationNumber: "",
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
    if (step !== TOTAL_STEPS) return;

    const formData = new FormData();
    formData.append("email", input.email);
    formData.append("phoneNumber", input.phoneNumber);
    formData.append("password", input.password);
    formData.append("organizationName", input.organizationName);
    formData.append("address", input.address);
    formData.append("province", input.province);
    formData.append("district", input.district);
    if (input.description) formData.append("description", input.description);
    if (input.website) formData.append("website", input.website);
    formData.append("category", input.category);
    formData.append("panNumber", input.panNumber);
    formData.append("registrationNumber", input.registrationNumber);
    formData.append("contactPersonName", input.contactPersonName);
    if (input.contactPersonEmail)
      formData.append("contactPersonEmail", input.contactPersonEmail);
    formData.append("contactPersonPhone", input.contactPersonPhone);
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
      toast.error(
        getApiErrorMessage(
          error,
          "Could not register. Check your connection and try again.",
        ),
      );
    } finally {
      dispatch(setLoading(false));
    }
  };

  const validateStep1 = () => {
    for (const key of Object.keys(STEP1_LABELS)) {
      if (!String(input[key] ?? "").trim()) {
        toast.error(`Please enter ${STEP1_LABELS[key]}.`);
        return false;
      }
    }
    const email = String(input.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid work email.");
      return false;
    }
    if (String(input.password).length < 6) {
      toast.error("Password must be at least 6 characters.");
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
  };

  useEffect(() => {
    formScrollRef.current?.scrollTo(0, 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const req = (label) => (
    <>
      {label}{" "}
      <span className="text-red-600" aria-hidden>
        *
      </span>
    </>
  );

  return (
    <div className="w-full flex-1 bg-[#f6faff]">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid h-[calc(100dvh-5.5rem)] min-h-0 overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(11,31,77,0.12)] md:h-[calc(100dvh-7rem)] md:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden border-b border-slate-100 md:h-full md:border-b-0">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-6 py-7 sm:px-10">
              <div className="mx-auto w-full max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Paropakar VendorNet
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Vendor registration
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {step === 1
                  ? "Account details and business location."
                  : "Business profile, registration, and authorized signatory."}
              </p>
              <div
                className="mt-5"
                role="progressbar"
                aria-valuenow={step}
                aria-valuemin={1}
                aria-valuemax={TOTAL_STEPS}
                aria-label={`Step ${step} of ${TOTAL_STEPS}`}
              >
                <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>
                    Step {step} of {TOTAL_STEPS}
                  </span>
                  <span className="text-slate-400">
                    {step === 1 ? "Account & location" : "Business & compliance"}
                  </span>
                </div>
                <div className="mt-2 flex h-2 gap-1.5 rounded-full bg-slate-200/80 p-0.5">
                  <div
                    className={cn(
                      "h-full flex-1 rounded-full transition-colors duration-300",
                      step >= 1 ? "bg-[#0b1f4d]" : "bg-transparent",
                    )}
                  />
                  <div
                    className={cn(
                      "h-full flex-1 rounded-full transition-colors duration-300",
                      step >= 2 ? "bg-[#0b1f4d]" : "bg-slate-300/60",
                    )}
                  />
                </div>
              </div>
              </div>
            </div>

            <form
              onSubmit={submitHandler}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div
                ref={formScrollRef}
                className="signup-form-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 sm:px-10 [scrollbar-gutter:stable]"
              >
                <div className="mx-auto w-full max-w-md space-y-4 pb-2">
                  {step === 1 && (
                    <>
                      <FormSection
                        icon={UserCircle2}
                        title="Account & contact"
                        description="Used to sign in and reach your organization."
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label className={fieldLabel}>
                              {req("Organization name")}
                            </Label>
                            <Input
                              type="text"
                              value={input.organizationName}
                              name="organizationName"
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div>
                            <Label className={fieldLabel}>{req("Work email")}</Label>
                            <Input
                              type="email"
                              value={input.email}
                              name="email"
                              onChange={changeEventHandler}
                              required
                              autoComplete="email"
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div>
                            <Label className={fieldLabel}>{req("Password")}</Label>
                            <Input
                              type="password"
                              value={input.password}
                              name="password"
                              onChange={changeEventHandler}
                              required
                              autoComplete="new-password"
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label className={fieldLabel}>{req("Phone")}</Label>
                            <Input
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              value={input.phoneNumber}
                              name="phoneNumber"
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                        </div>
                      </FormSection>

                      <FormSection
                        icon={Building2}
                        title="Location"
                        description="Where your business operates from."
                      >
                        <div>
                          <Label className={fieldLabel}>{req("Street address")}</Label>
                          <Input
                            type="text"
                            value={input.address}
                            name="address"
                            onChange={changeEventHandler}
                            required
                            className="mt-1.5 h-11"
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className={fieldLabel}>{req("Province")}</Label>
                            <Input
                              type="text"
                              value={input.province}
                              name="province"
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div>
                            <Label className={fieldLabel}>{req("District")}</Label>
                            <Input
                              type="text"
                              value={input.district}
                              name="district"
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                        </div>
                      </FormSection>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <FormSection
                        title="Business profile"
                        description="Helps procurement match your company to the right tenders."
                      >
                        <div>
                          <Label className={fieldLabel}>{req("Category")}</Label>
                          <select
                            name="category"
                            value={input.category}
                            onChange={changeEventHandler}
                            className="mt-1.5 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1f4d]/25"
                          >
                            {VENDOR_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className={fieldLabel}>
                            Description <span className={optionalHint}>(optional)</span>
                          </Label>
                          <textarea
                            name="description"
                            value={input.description}
                            onChange={changeEventHandler}
                            rows={2}
                            className="mt-1.5 flex min-h-[72px] max-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1f4d]/25"
                          />
                        </div>
                        <div>
                          <Label className={fieldLabel}>
                            Website <span className={optionalHint}>(optional)</span>
                          </Label>
                          <Input
                            type="url"
                            value={input.website}
                            name="website"
                            onChange={changeEventHandler}
                            className="mt-1.5 h-11"
                          />
                        </div>
                        <div>
                          <Label className={fieldLabel}>
                            Company logo <span className={optionalHint}>(optional)</span>
                          </Label>
                          <Input
                            accept="image/*"
                            type="file"
                            onChange={(e) =>
                              setLogoFile(e.target.files?.[0] ?? null)
                            }
                            className="mt-1.5 h-11 cursor-pointer border-dashed file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200/80"
                          />
                          {logoFile && (
                            <p className="mt-1.5 text-xs text-slate-500">
                              Selected: {logoFile.name}
                            </p>
                          )}
                        </div>
                      </FormSection>

                      <FormSection
                        icon={Shield}
                        title="Registration & tax"
                        description="Official identifiers for verification."
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className={fieldLabel}>{req("PAN number")}</Label>
                            <Input
                              type="text"
                              value={input.panNumber}
                              name="panNumber"
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div>
                            <Label className={fieldLabel}>
                              {req("Registration number")}
                            </Label>
                            <Input
                              type="text"
                              value={input.registrationNumber}
                              name="registrationNumber"
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                        </div>
                      </FormSection>

                      <FormSection title="Authorized signatory">
                        <p className="-mt-1 text-sm text-slate-500">
                          Person legally authorized to represent this vendor in
                          procurement.
                        </p>
                        <div className="grid gap-4 grid-cols-1">
                          <div>
                            <Label className={fieldLabel}>{req("Name")}</Label>
                            <Input
                              type="text"
                              name="contactPersonName"
                              value={input.contactPersonName}
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div>
                            <Label className={fieldLabel}>
                              Email <span className={optionalHint}>(optional)</span>
                            </Label>
                            <Input
                              type="email"
                              name="contactPersonEmail"
                              value={input.contactPersonEmail}
                              onChange={changeEventHandler}
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div>
                            <Label className={fieldLabel}>{req("Phone")}</Label>
                            <Input
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              name="contactPersonPhone"
                              value={input.contactPersonPhone}
                              onChange={changeEventHandler}
                              required
                              className="mt-1.5 h-11"
                            />
                          </div>
                        </div>
                      </FormSection>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-6 sm:px-10">
                <div className="mx-auto w-full max-w-md">
                {step === 2 && (
                  <p className="text-xs leading-relaxed text-slate-500">
                    After you submit, an administrator reviews and approves your
                    application before you can sign in.
                  </p>
                )}
                <div
                  className={cn(
                    "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
                    step === 2 ? "mt-4" : "mt-0",
                  )}
                >
                  {step === 1 ? (
                    <>
                      <Button
                        type="button"
                        onClick={goNext}
                        className="h-11 min-w-[160px] bg-[#0b1f4d] shadow-sm hover:bg-[#152a5c]"
                      >
                        Continue
                        <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 border-slate-300"
                        onClick={() => navigate("/")}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 border-slate-300"
                        onClick={goBack}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                        Back
                      </Button>
                      {loading ? (
                        <Button
                          type="button"
                          disabled
                          className="h-11 min-w-[180px] bg-[#0b1f4d] hover:bg-[#0b1f4d]"
                        >
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting…
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          className="h-11 min-w-[180px] bg-[#0b1f4d] shadow-sm hover:bg-[#152a5c]"
                        >
                          Submit application
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 text-slate-600"
                        onClick={() => navigate("/")}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  Already registered?{" "}
                  <Link
                    to="/login"
                    className="font-medium text-[#0b1f4d] underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
                </div>
              </div>
            </form>
          </div>

          <div className="hidden min-h-0 items-center justify-center bg-[#0b1f4d] md:flex md:h-full md:max-h-full md:overflow-hidden">
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
                <p className="mt-1 text-sm text-slate-400">
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

export default Signup;
