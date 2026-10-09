"use client";

import dynamic from "next/dynamic";

/**
 * The board is live-only: it shows nothing useful until the socket answers,
 * and it reads the chosen person from the URL and localStorage. Rendering it
 * on the client only avoids a server/client mismatch for no loss.
 */
const BoardApp = dynamic(() => import("./BoardApp"), {
  ssr: false,
  loading: () => <p style={{ padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>Loading the board…</p>,
});

export default BoardApp;
