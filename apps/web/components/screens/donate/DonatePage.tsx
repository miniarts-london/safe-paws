"use client";

import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import Check from "@mui/icons-material/Check";
import ContentCopy from "@mui/icons-material/ContentCopy";
import OpenInNew from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { BANK, PAYPAL_EMAIL, PAYPAL_ME_URL, PAYPAL_URL } from "@/lib/donation";
import { visuallyHidden } from "@/lib/visuallyHidden";
import { SiteFooter, SiteHeader } from "./../../SiteChrome";

/** The public page, for visitors who aren't signed in. Signed-in people see the same content inside the app. */
export function DonatePage() {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <SiteHeader signedIn={false} />
      <DonateContent />
      <SiteFooter />
    </Box>
  );
}

/** How to donate: bank transfer and PayPal, each detail with a copy button. */
export function DonateContent() {
  const [announce, setAnnounce] = useState("");

  return (
    <>
      <Box
        component="main"
        sx={{
          flex: 1,
          px: { xs: 2, sm: 3 },
          py: { xs: 5, sm: 8 },
          backgroundImage: (t) =>
            `radial-gradient(60rem 30rem at 50% 0%, ${t.vars ? t.vars.palette.mint.light : t.palette.mint.light}, transparent 70%)`,
        }}
      >
        <Stack spacing={5} sx={{ maxWidth: 920, mx: "auto" }}>
          <Stack spacing={2} sx={{ textAlign: "center", alignItems: "center" }}>
            <Typography
              variant="h1"
              sx={{ fontSize: { xs: "2.25rem", sm: "3rem" }, fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              Donate
            </Typography>
            <Typography sx={{ fontSize: { xs: "1.0625rem", sm: "1.2rem" }, lineHeight: 1.6, color: "text.secondary", maxWidth: 640 }}>
              Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet
              visits and many other essentials.
            </Typography>
            <Typography sx={{ fontSize: { xs: "1.0625rem", sm: "1.2rem" }, lineHeight: 1.6, color: "text.secondary", maxWidth: 640 }}>
              Your contribution is greatly appreciated and makes a huge difference to our animals’ lives.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr" },
              alignItems: "stretch",
            }}
          >
            <Card component="section" aria-labelledby="donate-bank" sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2.5 }}>
                <Badge>
                  <AccountBalanceOutlined />
                </Badge>
                <Box>
                  <Typography id="donate-bank" component="h2" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    Bank transfer
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {BANK.bank}
                  </Typography>
                </Box>
              </Stack>
              <Box component="dl" sx={{ m: 0 }}>
                {BANK.rows.map((r) => (
                  <Detail key={r.label} label={r.label} value={r.value} onCopied={setAnnounce} />
                ))}
              </Box>
            </Card>

            <Box
              aria-hidden
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
                fontWeight: 600,
                gap: 1.5,
                flexDirection: { xs: "row", md: "column" },
                "&::before, &::after": {
                  content: '""',
                  bgcolor: "divider",
                  flex: 1,
                  // A 1px rule: horizontal on phones, vertical between the cards on wide screens.
                  minHeight: "1px", // a string: in sx, 1 would mean 100%
                  minWidth: "1px",
                },
              }}
            >
              or
            </Box>

            <Card component="section" aria-labelledby="donate-paypal" sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2.5 }}>
                <Badge>
                  <Typography component="span" sx={{ fontWeight: 800, fontSize: 18 }}>
                    P
                  </Typography>
                </Badge>
                <Box>
                  <Typography id="donate-paypal" component="h2" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    PayPal
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Friends and family option
                  </Typography>
                </Box>
              </Stack>
              <Box component="dl" sx={{ m: 0 }}>
                <Detail label="Send to" value={PAYPAL_EMAIL} onCopied={setAnnounce} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.6 }}>
                Please choose <strong>Friends and family</strong> when you send, so the whole amount reaches the dogs.
                {!PAYPAL_ME_URL && <> On PayPal, paste the email above as who to send to.</>}
              </Typography>
              <Button
                href={PAYPAL_URL}
                target="_blank"
                rel="noopener"
                variant="contained"
                fullWidth
                endIcon={<OpenInNew />}
                sx={{ mt: 2.5, py: 1.25 }}
              >
                Pay with PayPal
                <Box component="span" sx={visuallyHidden}>
                  {" "}
                  (opens in a new tab)
                </Box>
              </Button>
            </Card>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Thank you.
          </Typography>
        </Stack>
      </Box>

      <Box role="status" sx={visuallyHidden}>
        {announce}
      </Box>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 44,
        height: 44,
        flex: "none",
        display: "grid",
        placeItems: "center",
        borderRadius: "12px",
        bgcolor: "mint.main",
        color: "mint.contrastText",
      }}
    >
      {children}
    </Box>
  );
}

/** One label and value, with a button to copy the value. */
function Detail({ label, value, onCopied }: { label: string; value: string; onCopied: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopied(`Couldn't copy. Select the ${label.toLowerCase()} and copy it instead.`);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        py: 1,
        borderTop: 1,
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0, pt: 0 },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="dt" variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography
          component="dd"
          sx={{ m: 0, fontWeight: 600, fontSize: "1.0625rem", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}
        >
          {value}
        </Typography>
      </Box>
      <Tooltip title={copied ? "Copied" : `Copy ${label.toLowerCase()}`}>
        <IconButton onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} sx={{ color: copied ? "mint.dark" : "text.secondary" }}>
          {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
