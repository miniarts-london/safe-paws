"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { PASSWORD_MIN, registerSchema, TITLE_MAX, type RegisterInput } from "@safe-paws/shared/schemas";
import NextLink from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { register } from "./actions";

export function RegisterForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", title: "" },
    mode: "onTouched",
  });

  const onSubmit = (values: RegisterInput) =>
    startTransition(async () => {
      // On success the action redirects to the board, so a returned value always means it failed.
      const result = await register(values, next);
      if (!result) return;
      if (result.field) setError(result.field, { message: result.error }, { shouldFocus: true });
      else setError("root.server", { message: result.error });
    });

  return (
    <Stack spacing={3}>
      <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="name"
                label="Your name"
                autoComplete="name"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? "Shown next to anything you post."}
              />
            )}
          />
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
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
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? `At least ${PASSWORD_MIN} characters.`}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="title"
                label="How you help (optional)"
                placeholder="e.g. Foster carer, Smouha"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? "Helps a coordinator know what access to give you."}
                slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
              />
            )}
          />
          {errors.root?.server && (
            <Alert severity="error" role="alert">
              {errors.root.server.message}
            </Alert>
          )}
          <Button type="submit" variant="contained" size="large" fullWidth loading={pending}>
            Create account
          </Button>
        </Stack>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        Already have an account?{" "}
        <Link component={NextLink} href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} sx={{ fontWeight: 600 }}>
          Sign in
        </Link>
      </Typography>
    </Stack>
  );
}
