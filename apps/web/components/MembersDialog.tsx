"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ROLE_LABELS, STAFF_ROLES, type Member } from "@safe-paws/shared/protocol";
import { approveSchema, TITLE_MAX, type ApproveInput } from "@safe-paws/shared/schemas";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSend } from "@/lib/useBoardSocket";

/**
 * Coordinators only, on the Settings page: new sign-ups to review. Make them
 * staff (with a role and the line shown under their name), or keep them as members.
 */
export function MembersSettings() {
  const members = useBoard((s) => s.members);
  const waiting = members.filter((m) => m.reviewedAt === null);
  const kept = members.filter((m) => m.reviewedAt !== null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Approving someone removes their row, taking keyboard focus with it. Bring focus
  // back to the section so Tab keeps working from here.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus();
  }, [members]);

  return (
    <Stack spacing={2} component="section" aria-labelledby="members-title">
      <Box>
        <Typography id="members-title" ref={headingRef} tabIndex={-1} variant="h2" component="h2" sx={{ "&:focus": { outline: "none" } }}>
          Members
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Anyone can sign up and see the board. Make volunteers staff so they can update it.
        </Typography>
      </Box>
      <Section title={`Waiting for review${waiting.length ? ` (${waiting.length})` : ""}`}>
        {waiting.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nobody new. When someone signs up, they&apos;ll appear here.
          </Typography>
        ) : (
          waiting.map((m) => <MemberRow key={m.id} member={m} />)
        )}
      </Section>
      {kept.length > 0 && (
        <Section title="Kept as members (last 30 days)">
          {kept.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </Section>
      )}
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack spacing={1.5} component="section">
      <Typography variant="overline" color="text.secondary" component="h3">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

const ROLE_HINT: Record<ApproveInput["role"], string> = {
  coordinator: "Runs the rescue; reviews new members",
  vet: "Hears when animals need a check",
  fosterer: "Hears when an animal needs a place to recover",
  sponsor: "Supports animals and follows their progress",
};

function MemberRow({ member }: { member: Member }) {
  const send = useSend();
  const now = useNow();
  const { control, handleSubmit } = useForm<ApproveInput>({
    resolver: zodResolver(approveSchema),
    defaultValues: { userId: member.id, role: "fosterer", title: member.title === "New member" ? "" : member.title },
    mode: "onSubmit",
  });
  const approve = handleSubmit((values) => send({ type: "member.approve", ...values }));

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ fontWeight: 650 }}>{member.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {member.email} · joined {timeAgo(member.joinedAt, now)}
          </Typography>
          {member.title !== "New member" && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              “{member.title}”
            </Typography>
          )}
        </Box>
        <Box component="form" noValidate onSubmit={approve}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Controller
              name="role"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  id={`role-${member.id}`}
                  label="Role"
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? ROLE_HINT[field.value]}
                  sx={{ minWidth: { sm: 170 } }}
                >
                  {STAFF_ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="title"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  id={`title-${member.id}`}
                  label="Shown under their name"
                  placeholder="e.g. Foster carer, Smouha"
                  size="small"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
                />
              )}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mt: 1.5 }}>
            {member.reviewedAt === null && (
              <Button color="inherit" onClick={() => send({ type: "member.keep", userId: member.id })}>
                Keep as member
              </Button>
            )}
            <Button type="submit" variant="contained">
              Make staff
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
