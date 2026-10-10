import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: `Create an account · ${SITE_NAME}` };

export default async function RegisterPage() {
  if (await getSession()) redirect("/board");

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "background.default" }}>
      <Card component="main" sx={{ width: "100%", maxWidth: 460, borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 }, "&:last-child": { pb: { xs: 3, sm: 4 } } }}>
          <Typography variant="h1" sx={{ mb: 1 }}>
            Join {SITE_NAME}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Follow the animals in care and get their news. If you volunteer with the rescue, a coordinator will give you
            access to update the board.
          </Typography>
          <RegisterForm />
        </CardContent>
      </Card>
    </Box>
  );
}
