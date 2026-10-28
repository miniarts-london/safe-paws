"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ROLE_LABELS, isStaff, type User } from "@safe-paws/shared/protocol";
import {
  PASSWORD_MIN,
  TITLE_MAX,
  changePasswordSchema,
  profileSchema,
  type ChangePasswordInput,
  type ProfileInput,
} from "@safe-paws/shared/schemas";
import { useBoard } from "@safe-paws/shared/store";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { changePassword } from "@/app/profile/actions";
import { useSend } from "@/lib/useBoardSocket";
import { MembersSettings } from "../../MembersDialog";

const page = { px: { xs: 2, sm: 3 }, py: 3, width: "100%", maxWidth: 720, mx: "auto" } as const;

/** Your name, the line shown under it, and your password. */
export function ProfilePage({ me, email }: { me: User; email: string }) {
  return (
    <Box sx={page}>
      <Typography variant="h1" sx={{ mb: 0.5 }}>
        Profile
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {isStaff(me.role) ? `Staff: ${ROLE_LABELS[me.role]}` : "Member"} · {email}
      </Typography>
      <Stack spacing={3}>
        <DetailsForm me={me} />
        <PasswordForm />
      </Stack>
    </Box>
  );
}

/** Saved through the board server, so everyone's copy of your name updates at once. */
function DetailsForm({ me }: { me: User }) {
  const send = useSend();
  const [sent, setSent] = useState<ProfileInput | null>(null);
  const { register, handleSubmit, formState } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me.name, title: me.title },
  });
  // The server sends everyone the updated person; once ours matches what we sent, it's saved.
  const saved = !!sent && me.name === sent.name.trim() && (sent.title.trim() === "" || me.title === sent.title.trim());
  const error = useBoard((s) => s.error);

  return (
    <Paper variant="outlined" component="section" aria-labelledby="details-title" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="details-title" variant="h2" component="h2" sx={{ mb: 2 }}>
        Your details
      </Typography>
      <Stack
        component="form"
        noValidate
        spacing={2}
        onSubmit={handleSubmit((values) => {
          setSent(values);
          send({ type: "profile.update", name: values.name, title: values.title });
        })}
      >
        <TextField
          label="Name"
          {...register("name")}
          error={!!formState.errors.name}
          helperText={formState.errors.name?.message}
          slotProps={{ htmlInput: { maxLength: 60, autoComplete: "name" } }}
        />
        <TextField
          label="Shown under your name"
          placeholder={isStaff(me.role) ? "e.g. Volunteer vet, Smouha" : "e.g. Dog lover, London"}
          {...register("title")}
          error={!!formState.errors.title}
          helperText={formState.errors.title?.message ?? "Everyone sees this next to your name."}
          slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
        />
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Button type="submit" variant="contained">
            Save
          </Button>
          <Typography variant="body2" color={sent && !saved && error ? "error" : "text.secondary"} role="status">
            {!sent ? "" : saved ? "Saved." : error ? "" : "Saving…"}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function PasswordForm() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const { register, handleSubmit, formState, setError, reset } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: "", next: "" },
  });
  return (
    <Paper variant="outlined" component="section" aria-labelledby="password-title" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="password-title" variant="h2" component="h2" sx={{ mb: 2 }}>
        Password
      </Typography>
      <Stack
        component="form"
        noValidate
        spacing={2}
        onSubmit={handleSubmit((values) =>
          start(async () => {
            setResult(null);
            const r = await changePassword(values);
            if (r.ok) {
              reset();
              setResult({ ok: true, message: "Password changed. Use the new one next time you sign in." });
            } else if (r.field) {
              setError(r.field, { message: r.error });
            } else {
              setResult({ ok: false, message: r.error });
            }
          }),
        )}
      >
        {/* Lets password managers save the new password against the right account. */}
        <input type="text" autoComplete="username" hidden readOnly />
        <TextField
          label="Current password"
          type="password"
          {...register("current")}
          error={!!formState.errors.current}
          helperText={formState.errors.current?.message}
          slotProps={{ htmlInput: { autoComplete: "current-password" } }}
        />
        <TextField
          label="New password"
          type="password"
          {...register("next")}
          error={!!formState.errors.next}
          helperText={formState.errors.next?.message ?? `At least ${PASSWORD_MIN} characters.`}
          slotProps={{ htmlInput: { autoComplete: "new-password" } }}
        />
        {result && <Alert severity={result.ok ? "success" : "error"}>{result.message}</Alert>}
        <Box>
          <Button type="submit" variant="contained" loading={pending}>
            Change password
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

/** Coordinators only (the page checks): reviewing new members. */
export function SettingsPage() {
  return (
    <Box sx={page}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Settings
      </Typography>
      <MembersSettings />
    </Box>
  );
}
