import { useEffect, useRef } from "react";
import axios from "axios";
import { Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "../shared/Navbar";
import Footer from "../shared/Footer";
import AppSidebar from "./AppSidebar";
import { NotificationSummaryProvider } from "../../context/NotificationSummaryContext";
import { setUser } from "@/redux/authSlice";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { mapApiRoleToSession, normalizeUserRoleFields } from "@/constants/userRoles";
import { USERS_ME_API_END_POINT } from "@/utils/constant";

/**
 * Global shell: navbar + scrollable main + footer. The main column grows (`flex-1`)
 * so short pages still pin the footer to the bottom instead of leaving a dead band.
 */
export default function AppShell() {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const showGlobalSidebar = Boolean(user);
  const hydratedUserIdRef = useRef("");

  useEffect(() => {
    const userId = String(user?.id || user?._id || "");
    if (!userId) {
      hydratedUserIdRef.current = "";
      return;
    }
    if (hydratedUserIdRef.current === userId) return;

    let cancelled = false;
    (async () => {
      try {
        const headers = getAuthHeaderFromStorage();
        const res = await axios.get(USERS_ME_API_END_POINT, {
          withCredentials: true,
          headers,
        });
        if (cancelled) return;
        const me = res?.data?.user;
        if (!me) return;
        dispatch(
          setUser(
            normalizeUserRoleFields({
              ...(user || {}),
              id: String(me?._id || userId),
              name: me?.name || user?.name || "",
              email: me?.email || user?.email || "",
              phoneNumber: me?.phoneNumber || user?.phoneNumber || "",
              profilePhoto: me?.profilePhoto || "",
              profile: {
                ...(user?.profile || {}),
                profilePhoto: me?.profilePhoto || "",
              },
              role: mapApiRoleToSession(me?.role ?? user?.role),
            }),
          ),
        );
      } catch {
        // Hydration is best-effort; failed /me leaves the last known client user intact.
      } finally {
        hydratedUserIdRef.current = userId;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, user]);

  const shell = (
    <>
      <Navbar />
      <main className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-x-clip pt-14 sm:pt-16 lg:pt-[72px]">
        {showGlobalSidebar ? (
          <div className="mx-auto flex w-full min-w-0 max-w-[1600px] gap-6 overflow-x-clip px-3 py-5 sm:gap-8 sm:px-6 sm:py-8 lg:px-10">
            <div className="hidden w-[248px] shrink-0 lg:block">
              <div className="sticky top-14 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain self-start pb-6 sm:top-16 sm:max-h-[calc(100vh-4.5rem)] lg:top-[72px] lg:max-h-[calc(100vh-5.5rem)]">
                <AppSidebar />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <Footer />
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      {user ? (
        <NotificationSummaryProvider>{shell}</NotificationSummaryProvider>
      ) : (
        shell
      )}
    </div>
  );
}
