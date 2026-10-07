import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function Extras() {
  const [cBalance, setCBalance] = useState(null);

  useEffect(() => {
    loadBalance();
  }, []);

  async function loadBalance() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("c_balance")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setCBalance(data.c_balance);
  }

  function watchAd() {
    // Real rewarded ad will go here later
  }

  return (
    <div className="extras-page">
      <div className="extras-content">
        <h1>You have: {cBalance === null ? "..." : cBalance} C</h1>

        <button
          className="watch-ad-button"
          onClick={watchAd}
        >
          Watch an ad for 50 C
        </button>
      </div>
    </div>
  );
}

export default Extras;