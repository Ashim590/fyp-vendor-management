import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import Navbar from "../shared/Navbar";
import Footer from "../shared/Footer";
import AppSidebar from "./AppSidebar";
import { NotificationSummaryProvider } from "../../context/NotificationSummaryContext";

/**
 * Global shell: navbar + scrollable main + footer.
 * flex-1 on main absorbs extra height so the footer sits at the bottom of the viewport
 * when content is short (no stray gap below the footer).
 */
export default function AppShell() {
  const { user } = useSelector((store) => store.auth);
  const showGlobalSidebar = Boolean(user);

  const shell = (
    <>
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col w-full pt-14 sm:pt-16 lg:pt-[72px]">
        {showGlobalSidebar ? (
          <div className="mx-auto flex w-full max-w-[1600px] gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
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
