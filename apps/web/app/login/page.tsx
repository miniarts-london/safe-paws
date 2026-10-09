import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEMO_PASSWORD, demoAccounts } from "@/lib/auth/accounts";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Safe Paws" };

export default async function LoginPage() {
  if (await getSession()) redirect("/board");

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "background.default" }}>
      <Card component="main" sx={{ width: "100%", maxWidth: 460, borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 }, "&:last-child": { pb: { xs: 3, sm: 4 } } }}>
          <Typography variant="h1" sx={{ mb: 1 }}>
            Safe Paws
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Sign in to see the animals in care and get updates on the ones you follow.
          </Typography>
          <LoginForm demos={demoAccounts} demoPassword={DEMO_PASSWORD} />
        </CardContent>
      </Card>
    </Box>
  );
}
