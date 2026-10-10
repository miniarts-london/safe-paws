"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { loginSchema, type LoginInput } from "@safe-paws/shared/schemas";
import NextLink from "next/link";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { login } from "./actions";

type Demo = { email: string; name: string; title: string };

export function LoginForm({ demos, demoPassword, next }: { demos: Demo[]; demoPassword: string; next?: string }) {
  const [pending, startTransition] = useTransition();
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched", // don't shout about empty fields before someone has tried them
  });

  const onSubmit = (values: LoginInput) =>
    startTransition(async () => {
      // On success the action redirects (to `next`, or the board), so a returned value always means it failed.
      const result = await login(values, next);
      if (result?.error) {
        setError("root.server", { message: result.error });
        setValue("password", "");
      }
    });

  // Fills the form and submits it, so a demo goes through exactly the same sign-in as a real person.
  const signInAs = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", demoPassword, { shouldValidate: true });
    void handleSubmit(onSubmit)();
  };

  return (
    <Stack spacing={3}>
      <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="email"
                label="Email"
                type="email"
                autoComplete="username"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                slotProps={{ htmlInput: { inputMode: "email" } }}
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          {errors.root?.server && (
            <Alert severity="error" role="alert">
              {errors.root.server.message}
            </Alert>
          )}
          <Button type="submit" variant="contained" size="large" fullWidth loading={pending}>
            Sign in
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        New here?{" "}
        <Link component={NextLink} href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} sx={{ fontWeight: 600 }}>
          Create an account
        </Link>
      </Typography>

      {demos.length > 0 && (
        <>
          <Divider />

          <Stack spacing={1.5} component="section" aria-labelledby="demo-title">
            <Typography id="demo-title" variant="h2" component="h2">
              Try it with a demo account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              To watch changes and notifications arrive live, sign in as one person here and as another in a private window
              (both windows of the same browser share one sign-in). Demo password: <code>{demoPassword}</code>
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              {demos.map((d) => (
                <Button
                  key={d.email}
                  variant="outlined"
                  color="inherit"
                  disabled={pending}
                  onClick={() => signInAs(d.email)}
                  sx={{ justifyContent: "flex-start", textAlign: "left", py: 1, borderColor: "divider" }}
                >
                  <Stack>
                    <Typography sx={{ fontWeight: 600 }}>{d.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {d.title}
                    </Typography>
                  </Stack>
                </Button>
              ))}
            </Box>
          </Stack>
        </>
      )}
    </Stack>
  );
}
