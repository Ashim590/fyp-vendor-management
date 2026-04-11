import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { setUser } from "@/redux/authSlice";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import {
  USERS_ME_API_END_POINT,
  USERS_ME_PASSWORD_API_END_POINT,
  VENDOR_ME_API_END_POINT,
  VENDOR_CATEGORIES,
} from "@/utils/constant";
import { SESSION_ROLE } from "@/constants/userRoles";
import { getApiErrorMessage } from "@/utils/apiError";

const Profile = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const currentRole = String(user?.role || "").toLowerCase();
  const isAdmin = currentRole === SESSION_ROLE.ADMIN;
  const isStaff = currentRole === SESSION_ROLE.PROCUREMENT_OFFICER;
  const isVendor = currentRole === SESSION_ROLE.VENDOR;

  const [loading, setLoading] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingVendorInfo, setSavingVendorInfo] = useState(false);
  const [profile, setProfile] = useState(null);

  const [personalForm, setPersonalForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    address: "",
    province: "",
    district: "",
    website: "",
    description: "",
    businessCategory: "other",
    panNumber: "",
    registrationNumber: "",
    authorizedPersonName: "",
    authorizedPersonEmail: "",
    authorizedPersonPhone: "",
    settlementEsewaId: "",
  });
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const prefStorageKey = useMemo(
    () => `profile_prefs_${currentRole}_${user?.id || "me"}`,
    [currentRole, user?.id],
  );
  const [preferences, setPreferences] = useState({
    vendorApprovals: true,
    prApprovals: true,
    deliveryDelays: true,
    paymentFailures: true,
    emailDigest: false,
  });

  useEffect(() => {
    const raw = localStorage.getItem(prefStorageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPreferences((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore invalid local preference data
      }
    }
  }, [prefStorageKey]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaderFromStorage();
        const res = await axios.get(USERS_ME_API_END_POINT, {
          withCredentials: true,
          headers,
        });
        const me = res?.data?.user;
        setProfile(me);
        setPersonalForm({
          name: me?.name || "",
          email: me?.email || "",
          phoneNumber: me?.phoneNumber || "",
        });
        setProfilePhotoFile(null);
        setRemoveProfilePhoto(false);
        const vendorProfile = me?.vendorProfile || {};
        setVendorForm({
          companyName: vendorProfile?.name || "",
          companyEmail: vendorProfile?.email || "",
          companyPhone: vendorProfile?.phoneNumber || "",
          address: vendorProfile?.address || "",
          province: vendorProfile?.province || "",
          district: vendorProfile?.district || "",
          website: vendorProfile?.website || "",
          description: vendorProfile?.description || "",
          businessCategory: vendorProfile?.category || "other",
          panNumber: vendorProfile?.panNumber || vendorProfile?.taxId || "",
          registrationNumber:
            vendorProfile?.registrationNumber ||
            vendorProfile?.businessLicense ||
            "",
          authorizedPersonName: vendorProfile?.contactPerson?.name || "",
          authorizedPersonEmail: vendorProfile?.contactPerson?.email || "",
          authorizedPersonPhone: vendorProfile?.contactPerson?.phone || "",
          settlementEsewaId: vendorProfile?.bankDetails?.esewaId || "",
        });
        dispatch(
          setUser({
            ...(user || {}),
            id: String(me?._id || user?.id || ""),
            name: me?.name || user?.name || "",
            email: me?.email || user?.email || "",
            phoneNumber: me?.phoneNumber || "",
            profilePhoto: me?.profilePhoto || "",
            profile: {
              ...(user?.profile || {}),
              profilePhoto: me?.profilePhoto || "",
            },
          }),
        );
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Failed to load profile"));
      } finally {
        setLoading(false);
      }
    };
    loadMe();
  }, [dispatch]);

  const onSavePersonal = async (e) => {
    e.preventDefault();
    try {
      setSavingInfo(true);
      let payload = personalForm;
      let config = undefined;
      if (profilePhotoFile) {
        const fd = new FormData();
        fd.append("name", String(personalForm.name || ""));
        fd.append("email", String(personalForm.email || ""));
        fd.append("phoneNumber", String(personalForm.phoneNumber || ""));
        fd.append("profilePhoto", profilePhotoFile);
        payload = fd;
        config = {
          headers: {
            ...getAuthHeaderFromStorage(),
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        };
      } else if (removeProfilePhoto) {
        payload = {
          ...personalForm,
          profilePhoto: "",
        };
      }
      const res = await axios.patch(USERS_ME_API_END_POINT, payload, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
        ...(config || {}),
      });
      const me = res?.data?.user;
      setProfile(me);
      setProfilePhotoFile(null);
      setRemoveProfilePhoto(false);
      dispatch(
        setUser({
          ...(user || {}),
          id: String(me?._id || user?.id || ""),
          name: me?.name || "",
          email: me?.email || "",
          phoneNumber: me?.phoneNumber || "",
          profilePhoto: me?.profilePhoto || "",
          profile: {
            ...(user?.profile || {}),
            profilePhoto: me?.profilePhoto || "",
          },
        }),
      );
      toast.success("Personal information updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update profile"));
    } finally {
      setSavingInfo(false);
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (!securityForm.currentPassword || !securityForm.newPassword) {
      toast.error("Current and new password are required");
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }
    try {
      setSavingPassword(true);
      await axios.patch(
        USERS_ME_PASSWORD_API_END_POINT,
        {
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        },
        {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        },
      );
      setSecurityForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password updated successfully");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update password"));
    } finally {
      setSavingPassword(false);
    }
  };

  const onSavePrefs = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    localStorage.setItem(prefStorageKey, JSON.stringify(preferences));
    toast.success("Preferences saved");
    setSavingPrefs(false);
  };

  const onSaveVendorInfo = async (e) => {
    e.preventDefault();
    if (!isVendor) return;
    try {
      setSavingVendorInfo(true);
      const res = await axios.put(
        VENDOR_ME_API_END_POINT,
        {
          name: vendorForm.companyName,
          email: vendorForm.companyEmail,
          phoneNumber: vendorForm.companyPhone,
          address: vendorForm.address,
          province: vendorForm.province,
          district: vendorForm.district,
          website: vendorForm.website,
          description: vendorForm.description,
          category: vendorForm.businessCategory,
          panNumber: vendorForm.panNumber,
          registrationNumber: vendorForm.registrationNumber,
          contactPerson: {
            name: vendorForm.authorizedPersonName,
            email: vendorForm.authorizedPersonEmail,
            phone: vendorForm.authorizedPersonPhone,
          },
          settlementEsewaId: vendorForm.settlementEsewaId,
        },
        {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        },
      );
      const updatedVendor = res?.data?.vendor;
      if (updatedVendor) {
        setProfile((prev) => ({
          ...(prev || {}),
          vendorProfile: updatedVendor,
        }));
      }
      toast.success("Company details updated");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to update company details"),
      );
    } finally {
      setSavingVendorInfo(false);
    }
  };

  const onProfilePhotoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhotoFile(file);
    setRemoveProfilePhoto(false);
  };

  const onRemovePhoto = () => {
    setProfilePhotoFile(null);
    setRemoveProfilePhoto(true);
    setProfile((prev) => ({
      ...(prev || {}),
      profilePhoto: "",
    }));
  };

  const roleLabel = isAdmin
    ? "Administrator"
    : isStaff
      ? "Procurement Officer"
      : "Vendor";
  const notifRows = isAdmin
    ? [
        ["vendorApprovals", "New vendor approvals"],
        ["prApprovals", "Purchase request approvals"],
        ["deliveryDelays", "Delivery delay alerts"],
        ["paymentFailures", "Payment failure alerts"],
        ["emailDigest", "Daily email digest"],
      ]
    : isStaff
      ? [
          ["prApprovals", "Purchase request updates"],
          ["deliveryDelays", "Delivery delay alerts"],
          ["paymentFailures", "Payment failure alerts"],
          ["emailDigest", "Daily email digest"],
        ]
      : [
          ["paymentFailures", "Payment status alerts"],
          ["deliveryDelays", "Delivery updates"],
          ["emailDigest", "Daily email digest"],
        ];

  return (
    <div className="w-full flex-1 bg-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={profile?.profilePhoto || ""}
                alt={profile?.name || "Admin"}
              />
              <AvatarFallback>
                {String(profile?.name || "A")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {profile?.name || user?.name || roleLabel}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge>{roleLabel}</Badge>
                <span className="text-xs text-slate-500">
                  ID: {String(profile?._id || user?.id || "N/A")}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={onSavePersonal}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Personal Info & Contact
            </h2>
            <Input
              value={personalForm.name}
              onChange={(e) =>
                setPersonalForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="Full name"
            />
            <Input
              type="email"
              value={personalForm.email}
              onChange={(e) =>
                setPersonalForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="Email"
            />
            <Input
              value={personalForm.phoneNumber}
              onChange={(e) =>
                setPersonalForm((p) => ({ ...p, phoneNumber: e.target.value }))
              }
              placeholder="Phone number"
            />
            <Input type="file" accept="image/*" onChange={onProfilePhotoFile} />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-600"
                onClick={onRemovePhoto}
                disabled={!profile?.profilePhoto && !profilePhotoFile}
              >
                Remove Photo
              </Button>
              <Button type="submit" disabled={savingInfo || loading}>
                {savingInfo ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>

          <form
            onSubmit={onChangePassword}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Security & Password
            </h2>
            <Input
              type="password"
              value={securityForm.currentPassword}
              onChange={(e) =>
                setSecurityForm((p) => ({
                  ...p,
                  currentPassword: e.target.value,
                }))
              }
              placeholder="Current password"
            />
            <Input
              type="password"
              value={securityForm.newPassword}
              onChange={(e) =>
                setSecurityForm((p) => ({ ...p, newPassword: e.target.value }))
              }
              placeholder="New password"
            />
            <Input
              type="password"
              value={securityForm.confirmPassword}
              onChange={(e) =>
                setSecurityForm((p) => ({
                  ...p,
                  confirmPassword: e.target.value,
                }))
              }
              placeholder="Confirm new password"
            />
            <Button type="submit" disabled={savingPassword || loading}>
              {savingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </section>

        {isVendor && (
          <section>
            <form
              onSubmit={onSaveVendorInfo}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
            >
              <h2 className="text-base font-semibold text-slate-900">
                Company Info & Contact
              </h2>
              <Input
                value={vendorForm.companyName}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, companyName: e.target.value }))
                }
                placeholder="Company name"
              />
              <Input
                type="email"
                value={vendorForm.companyEmail}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, companyEmail: e.target.value }))
                }
                placeholder="Company email"
              />
              <Input
                value={vendorForm.companyPhone}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, companyPhone: e.target.value }))
                }
                placeholder="Company phone"
              />
              <Input
                value={vendorForm.address}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Address"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={vendorForm.province}
                  onChange={(e) =>
                    setVendorForm((p) => ({ ...p, province: e.target.value }))
                  }
                  placeholder="Province"
                />
                <Input
                  value={vendorForm.district}
                  onChange={(e) =>
                    setVendorForm((p) => ({ ...p, district: e.target.value }))
                  }
                  placeholder="District"
                />
              </div>
              <Input
                value={vendorForm.panNumber}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, panNumber: e.target.value }))
                }
                placeholder="PAN number"
              />
              <Input
                value={vendorForm.registrationNumber}
                onChange={(e) =>
                  setVendorForm((p) => ({
                    ...p,
                    registrationNumber: e.target.value,
                  }))
                }
                placeholder="Registration number"
              />
              <Input
                value={vendorForm.website}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, website: e.target.value }))
                }
                placeholder="Website"
              />
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-700">
                  Business category
                </Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={vendorForm.businessCategory}
                  onChange={(e) =>
                    setVendorForm((p) => ({
                      ...p,
                      businessCategory: e.target.value,
                    }))
                  }
                >
                  {VENDOR_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                value={vendorForm.authorizedPersonName}
                onChange={(e) =>
                  setVendorForm((p) => ({
                    ...p,
                    authorizedPersonName: e.target.value,
                  }))
                }
                placeholder="Authorized person name"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="email"
                  value={vendorForm.authorizedPersonEmail}
                  onChange={(e) =>
                    setVendorForm((p) => ({
                      ...p,
                      authorizedPersonEmail: e.target.value,
                    }))
                  }
                  placeholder="Authorized person email"
                />
                <Input
                  value={vendorForm.authorizedPersonPhone}
                  onChange={(e) =>
                    setVendorForm((p) => ({
                      ...p,
                      authorizedPersonPhone: e.target.value,
                    }))
                  }
                  placeholder="Authorized person phone"
                />
              </div>
              <Input
                value={vendorForm.settlementEsewaId}
                onChange={(e) =>
                  setVendorForm((p) => ({
                    ...p,
                    settlementEsewaId: e.target.value,
                  }))
                }
                placeholder="eSewa settlement ID (Tier 2)"
              />
              <Input
                value={vendorForm.description}
                onChange={(e) =>
                  setVendorForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Description"
              />
              <Button type="submit" disabled={savingVendorInfo || loading}>
                {savingVendorInfo ? "Saving..." : "Save Company Info"}
              </Button>
            </form>
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={onSavePrefs}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Preferences & Notifications
            </h2>
            {notifRows.map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(preferences[key])}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, [key]: e.target.checked }))
                  }
                />
              </label>
            ))}
            <p className="text-xs text-slate-500">
              These preferences are saved on this browser for now.
            </p>
            <Button type="submit" disabled={savingPrefs}>
              {savingPrefs ? "Saving..." : "Save Preferences"}
            </Button>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Activity & Account Info
            </h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium">User ID:</span>{" "}
                {String(profile?._id || user?.id || "N/A")}
              </p>
              <p>
                <span className="font-medium">Role:</span> {roleLabel}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                {profile?.isActive ? "Active" : "Inactive"}
              </p>
              <p>
                <span className="font-medium">Created:</span>{" "}
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleString()
                  : "N/A"}
              </p>
              <p>
                <span className="font-medium">Last Updated:</span>{" "}
                {profile?.updatedAt
                  ? new Date(profile.updatedAt).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;
