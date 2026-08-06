"use client";
import BottomNav from "@/components/layout/BottomNav";
import SearchInput from "@/components/ui/SearchInput";
import eventEmitter from "@/utils/eventEmitter";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useState } from "react";
import OfflineStatus from "@/components/OfflineStatus";
import { clearOfflineDataForCurrentUser } from "@/utils/lib/offlineBookingStore";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [filterModalOpened, setFilterModalOpened] = useState<boolean>(false);
  const [openedDropDown, setOpenedDropDown] = useState<Boolean>(false);

  const [searchText, setSearchText] = useState("");
  const handleChangeSearch = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSearchText(value);
  };
  const signOut = async () => {
    await clearOfflineDataForCurrentUser();
    await supabase.auth.signOut();
    router.push("/");
  };
  useEffect(() => {
    // Subscribe to the layout button click event
    eventEmitter.on("searchTextChangedFromChild", handleChangeSearch);

    // Cleanup subscription on unmount
    return () => {
      eventEmitter.off("searchTextChangedFromChild", handleChangeSearch);
    };
  }, []);
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user ?? null;
      if (navigator.onLine) {
        const verified = await supabase.auth.getUser();
        user = verified.data.user ?? user;
      }
      console.log("====================================");
      console.log(user);
      console.log("====================================");
      setUser(user);
    };

    fetchUser();
  }, []);
  return (
    <main className="min-h-screen flex flex-col justify-between w-full laptop-up:flex-row-reverse  ">
      {/* Router view */}
      <section className="router-view min-w-0 flex-1 scroll-auto">
        {/* header for laptop up */}
        <div className="h-24 px-10 flex items-center border-b-[0.4px] border-[#D0D0D066] justify-between tablet-down:hidden">
          {/* Top Nav */}
          <SearchInput
            className="w-1/2"
            onChange={(e) => {
              eventEmitter.emit("searchTextChanged", e);
              handleChangeSearch(e);
            }}
            value={searchText}
            onFilterClick={() => {
              setFilterModalOpened(!filterModalOpened)
              eventEmitter.emit("filterBtnClicked", filterModalOpened);
            }}
          />
          <div className="flex items-center gap-4">
            <div className="notif h-9 w-9 rounded-full bg-blueShade flex items-center justify-center cursor-pointer hover:shadow-md hover:shadow-selectedButton/20">
              <span
                className={`material-symbols-outlined cursor-pointer  !text-selectedButton`}
              >
                notifications
              </span>
            </div>
            <div className="flex items-center gap-2 relative">
              <div onClick={() => setOpenedDropDown(!openedDropDown)} className="cursor-pointer avartar h-9 w-9 rounded-full bg-[url('https://avatar.iran.liara.run/public/44')] bg-no-repeat bg-center bg-cover"></div>
              <div
                className={`${openedDropDown ? "flex " : "hidden "}bg-white rounded-xl shadow-lg absolute top-12  flex-col z-50 w-36`}
              >
                <label
                  className="p-4 rounded-t-xl hover:bg-typo_light-100 cursor-pointer"
                  onClick={signOut}
                >
                  Logout
                </label>

              </div>
              <div>
                <h3 className="small-text !font-bold">
                  Hi! {user?.user_metadata?.display_name}
                </h3>
                <span className="small-text text-[#BEBEBE]">Welcome back</span>
              </div>
            </div>
          </div>
        </div>
        <OfflineStatus />
        {children}
      </section>
      {/* Bottom Nav bar */}
      <BottomNav />
    </main >
  );
}
